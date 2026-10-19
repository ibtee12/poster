/**
 * lib/faceDetect.ts
 * Browser-based Face Detection using MediaPipe FaceDetector (@mediapipe/tasks-vision).
 * - Detects presence of human faces in the photo.
 * - Rejects photos with no face.
 * - Handles multiple faces by selecting the largest face and issuing a warning.
 * - Computes face-guided scale and placement to fit inside the slot consistently.
 */

import { FaceDetector, FilesetResolver, Detection } from "@mediapipe/tasks-vision";

export interface NormalizedFaceBox {
  originX: number; // 0..1 fraction of image width
  originY: number; // 0..1 fraction of image height
  width: number; // 0..1 fraction of image width
  height: number; // 0..1 fraction of image height
  pixelBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FaceDetectionResult {
  hasFace: boolean;
  error?: string;
  warnings: string[];
  mainFace?: NormalizedFaceBox;
  faceCount: number;
  rawDetections?: Detection[];
}

let faceDetectorSingleton: FaceDetector | null = null;
let detectorLoadingPromise: Promise<FaceDetector> | null = null;

/**
 * Initializes and caches the MediaPipe FaceDetector instance.
 * Loads wasm and model locally with CDN fallback for maximum resilience.
 */
export async function getFaceDetector(): Promise<FaceDetector> {
  if (faceDetectorSingleton) {
    return faceDetectorSingleton;
  }

  if (detectorLoadingPromise) {
    return detectorLoadingPromise;
  }

  detectorLoadingPromise = (async () => {
    let vision;
    try {
      // Try local wasm first
      vision = await FilesetResolver.forVisionTasks("/wasm");
    } catch (localErr) {
      console.warn("Local MediaPipe wasm unavailable, falling back to CDN:", localErr);
      vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
    }

    try {
      // Try local model first
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.4,
      });
      faceDetectorSingleton = detector;
      return detector;
    } catch (gpuErr) {
      console.warn("GPU delegate failed, attempting CPU delegate:", gpuErr);
      try {
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/blaze_face_short_range.tflite",
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.4,
        });
        faceDetectorSingleton = detector;
        return detector;
      } catch (modelErr) {
        // Fallback to CDN model URL
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.4,
        });
        faceDetectorSingleton = detector;
        return detector;
      }
    }
  })();

  return detectorLoadingPromise;
}

/**
 * Detects faces in an image element.
 */
export async function detectFacesInImage(
  image: HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionResult> {
  const detector = await getFaceDetector();
  const result = detector.detect(image);

  const imgWidth =
    (image as HTMLImageElement).naturalWidth || (image as HTMLCanvasElement).width;
  const imgHeight =
    (image as HTMLImageElement).naturalHeight || (image as HTMLCanvasElement).height;

  const detections = result.detections || [];
  const warnings: string[] = [];

  // 1. No face detected
  if (detections.length === 0) {
    return {
      hasFace: false,
      error: "Please upload a clear photo with your face visible.",
      warnings: [],
      faceCount: 0,
      rawDetections: detections,
    };
  }

  // 2. Multiple faces detected: select largest face
  if (detections.length > 1) {
    warnings.push(
      `Multiple faces detected (${detections.length}). Focusing on the main face.`
    );
  }

  let largestArea = -1;
  let largestDetection: Detection = detections[0];

  for (const det of detections) {
    if (det.boundingBox) {
      const area = det.boundingBox.width * det.boundingBox.height;
      if (area > largestArea) {
        largestArea = area;
        largestDetection = det;
      }
    }
  }

  const bb = largestDetection.boundingBox || {
    originX: imgWidth * 0.25,
    originY: imgHeight * 0.1,
    width: imgWidth * 0.5,
    height: imgHeight * 0.5,
  };

  const normalizedFace: NormalizedFaceBox = {
    originX: Math.max(0, Math.min(1, bb.originX / imgWidth)),
    originY: Math.max(0, Math.min(1, bb.originY / imgHeight)),
    width: Math.max(0.01, Math.min(1, bb.width / imgWidth)),
    height: Math.max(0.01, Math.min(1, bb.height / imgHeight)),
    pixelBox: {
      x: bb.originX,
      y: bb.originY,
      width: bb.width,
      height: bb.height,
    },
  };

  return {
    hasFace: true,
    warnings,
    mainFace: normalizedFace,
    faceCount: detections.length,
    rawDetections: detections,
  };
}

/**
 * Computes face-guided scale and placement so:
 * (a) face height matches slot target (faceHeightRatio)
 * (b) face is kept fully inside the slot boundary
 * (c) bottom anchor ensures cutout bottom reaches or extends past slot bottom
 */
export function computeFacePlacement(params: {
  slotX: number;
  slotY: number;
  slotW: number;
  slotH: number;
  cutoutW: number;
  cutoutH: number;
  faceBox?: NormalizedFaceBox;
  faceHeightRatio?: number; // default 0.38
  anchor?: "bottom" | "center";
}): {
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
  scale: number;
} {
  const { slotX, slotY, slotW, slotH, cutoutW, cutoutH, faceBox, anchor = "bottom" } = params;

  // Fallback if no faceBox: bounding box fit
  if (!faceBox) {
    const scale = Math.min(slotW / cutoutW, slotH / cutoutH);
    const drawW = cutoutW * scale;
    const drawH = cutoutH * scale;
    const drawX = slotX + (slotW - drawW) / 2;
    let drawY = slotY + slotH - drawH;
    if (anchor === "center") {
      drawY = slotY + (slotH - drawH) / 2;
    }
    return { drawX, drawY, drawW, drawH, scale };
  }

  // Face height in cutout coordinates
  const faceCutoutH = faceBox.height * cutoutH;
  const faceCutoutW = faceBox.width * cutoutW;

  // Target face height inside the slot
  const targetFaceRatio = params.faceHeightRatio || 0.38;
  const targetFaceH = slotH * targetFaceRatio;

  // Scale based on face height target
  let scale = faceCutoutH > 0 ? targetFaceH / faceCutoutH : slotH / cutoutH;

  // Ensure scale isn't ridiculously small or gigantic
  const minScale = (slotW * 0.4) / cutoutW;
  const maxScale = (slotH * 1.5) / cutoutH;
  scale = Math.max(minScale, Math.min(maxScale, scale));

  let drawW = cutoutW * scale;
  let drawH = cutoutH * scale;

  // Center the face horizontally inside the slot
  const faceCenterX = (faceBox.originX + faceBox.width / 2) * cutoutW * scale;
  let drawX = slotX + slotW / 2 - faceCenterX;

  // Ensure the face box is fully horizontally inside the slot
  const faceDrawLeft = drawX + faceBox.originX * cutoutW * scale;
  const faceDrawRight = faceDrawLeft + faceCutoutW * scale;

  if (faceDrawLeft < slotX) {
    drawX += slotX - faceDrawLeft;
  } else if (faceDrawRight > slotX + slotW) {
    drawX -= faceDrawRight - (slotX + slotW);
  }

  // Vertical placement
  let drawY = slotY + slotH - drawH;
  if (anchor === "center") {
    drawY = slotY + (slotH - drawH) / 2;
  }

  // Check face vertical containment inside slot
  const faceDrawTop = drawY + faceBox.originY * cutoutH * scale;
  const faceDrawBottom = faceDrawTop + faceCutoutH * scale;

  // If face top is clipped by slot top, push down
  if (faceDrawTop < slotY) {
    drawY += slotY - faceDrawTop;
  }
  // If face bottom exceeds slot bottom, pull up
  if (faceDrawBottom > slotY + slotH) {
    drawY -= faceDrawBottom - (slotY + slotH);
  }

  // For bottom anchor, ensure bottom edge covers slot bottom (no gap below)
  if (anchor === "bottom" && drawY + drawH < slotY + slotH) {
    drawY = slotY + slotH - drawH;
  }

  return { drawX, drawY, drawW, drawH, scale };
}
