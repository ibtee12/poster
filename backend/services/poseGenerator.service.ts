import { prisma } from "../db/prisma";

export interface PoseGenerationInput {
  userPhotoBuffer: Buffer;
  userPhotoMimeType?: string;
  poseRefBuffer?: Buffer;
  poseRefUrl?: string;
  prompt?: string;
}

export interface PoseGenerator {
  generate(input: PoseGenerationInput): Promise<Buffer>;
}

/**
 * Mock Pose Generator for testing and local development.
 * Returns the original photo (or throws on simulated failure).
 */
export class MockPoseGenerator implements PoseGenerator {
  async generate(input: PoseGenerationInput): Promise<Buffer> {
    // Check for test failure trigger to verify automatic refund flow
    const textPreview = input.userPhotoBuffer
      .slice(0, 1024)
      .toString("utf-8", 0, Math.min(1024, input.userPhotoBuffer.length));

    if (
      input.prompt?.includes("force_failure") ||
      textPreview.includes("force_failure") ||
      process.env.MOCK_POSE_FORCE_FAIL === "true"
    ) {
      throw new Error("Simulated AI generation failure (testing automatic refund).");
    }

    // Small delay to simulate async background processing
    await new Promise((resolve) => setTimeout(resolve, 800));

    // In mock mode, the original photo is successfully returned as the generated result
    return input.userPhotoBuffer;
  }
}

/**
 * Replicate AI Pose Generator (ControlNet / InstantID / OpenPose)
 * Uses official Replicate HTTP Predictions API.
 * Server-side only: REPLICATE_API_TOKEN is never sent to the browser.
 */
export class ReplicatePoseGenerator implements PoseGenerator {
  private apiToken: string;
  private modelVersion: string;

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || "";
    // Default model: InstantID or SDXL OpenPose ControlNet
    this.modelVersion =
      process.env.REPLICATE_MODEL_VERSION ||
      "43d309c37abb4e6d23e769cbc420f61ad2514ca7ad30abc0e0032d967c299ab3"; // InstantID standard weights
  }

  async generate(input: PoseGenerationInput): Promise<Buffer> {
    if (!this.apiToken || this.apiToken.startsWith("mock_")) {
      console.warn("REPLICATE_API_TOKEN not set or is mock; falling back to MockPoseGenerator.");
      const mock = new MockPoseGenerator();
      return mock.generate(input);
    }

    // Convert user photo to data URI
    const userPhotoBase64 = input.userPhotoBuffer.toString("base64");
    const mime = input.userPhotoMimeType || "image/png";
    const userPhotoDataUri = `data:${mime};base64,${userPhotoBase64}`;

    let poseRefDataUri = input.poseRefUrl;
    if (input.poseRefBuffer) {
      poseRefDataUri = `data:image/png;base64,${input.poseRefBuffer.toString("base64")}`;
    }

    // Start prediction on Replicate
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: this.modelVersion,
        input: {
          image: userPhotoDataUri,
          pose_image: poseRefDataUri || userPhotoDataUri,
          prompt: input.prompt || "professional high quality studio portrait, crisp focus, neutral background",
          negative_prompt: "blurry, low quality, distorted, extra limbs",
          num_outputs: 1,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Replicate API error (${createRes.status}): ${errText}`);
    }

    const prediction = await createRes.json();
    const predictionId = prediction.id;

    // Poll prediction status until completion
    let completed = false;
    let outputUrl: string | null = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 * 2s = 120s max

    while (!completed && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
        },
      });

      if (!pollRes.ok) {
        throw new Error(`Replicate polling error (${pollRes.status})`);
      }

      const statusData = await pollRes.json();
      if (statusData.status === "succeeded") {
        completed = true;
        outputUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
      } else if (statusData.status === "failed" || statusData.status === "canceled") {
        throw new Error(statusData.error || `Replicate prediction failed with status ${statusData.status}`);
      }
    }

    if (!outputUrl) {
      throw new Error("Replicate prediction timed out or returned no output image.");
    }

    // Download generated image
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to download Replicate generated image (${imgRes.status})`);
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

/**
 * Returns configured PoseGenerator instance.
 */
export function getPoseGenerator(): PoseGenerator {
  const provider = (process.env.POSE_PROVIDER || "mock").toLowerCase();
  if (provider === "replicate") {
    return new ReplicatePoseGenerator();
  }
  return new MockPoseGenerator();
}
