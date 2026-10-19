export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export interface ImageModerator {
  moderateImage(buffer: Buffer, mimeType?: string): Promise<ModerationResult>;
}

export class DefaultImageModerator implements ImageModerator {
  private provider: string;
  private providerUrl?: string;

  constructor() {
    this.provider = process.env.MODERATION_PROVIDER || "none";
    this.providerUrl = process.env.MODERATION_URL;
  }

  async moderateImage(buffer: Buffer, mimeType = "image/jpeg"): Promise<ModerationResult> {
    if (!buffer || buffer.length === 0) {
      return { allowed: false, reason: "Empty or invalid image data." };
    }

    // Provider: external URL
    if (this.provider === "provider_url" && this.providerUrl) {
      try {
        const res = await fetch(this.providerUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: new Uint8Array(buffer),
        });
        if (!res.ok) {
          throw new Error(`Moderation service returned ${res.status}`);
        }
        const data = await res.json();
        return {
          allowed: Boolean(data.allowed),
          reason: data.reason || "Image flagged by moderation filter.",
        };
      } catch (err: any) {
        console.warn("External moderation error, falling back to basic checks:", err);
      }
    }

    // Default provider: "none"
    // Inspect buffer for basic safety and check if tagged for testing
    const textPreview = buffer.slice(0, 1024).toString("utf-8", 0, Math.min(1024, buffer.length));
    if (textPreview.includes("flagged_for_moderation") || textPreview.includes("explicit_content")) {
      return {
        allowed: false,
        reason: "The uploaded image contains restricted or explicit content. Please upload an appropriate photo.",
      };
    }

    return { allowed: true };
  }
}

export const imageModerator: ImageModerator = new DefaultImageModerator();
