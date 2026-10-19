/**
 * lib/photoChecks.ts
 * Pre-checks for user-uploaded photos before processing:
 * 1. Allowed MIME types: JPG, PNG, WebP, AVIF
 * 2. Maximum file size: 50 MB
 * 3. Blurriness detection: Variance of the Laplacian
 * 4. Lighting detection: Mean grayscale brightness (dark / overexposed)
 */

export interface PhotoCheckResult {
  valid: boolean; // false for non-bypassable hard errors
  error?: string; // Hard error message
  warnings: string[]; // Warnings where user can choose "Use anyway"
  width: number;
  height: number;
  blurScore: number;
  brightness: number;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// Variance of Laplacian threshold for blurriness (sampled on ~400px canvas)
export const LAPLACIAN_BLUR_THRESHOLD = 75;

// Mean brightness thresholds (0 - 255)
export const DARK_BRIGHTNESS_THRESHOLD = 45;
export const OVEREXPOSED_BRIGHTNESS_THRESHOLD = 220;

/**
 * Loads a File or Blob into an HTMLImageElement
 */
export function loadImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image file. Please ensure it is a valid image."));
    };
    img.src = url;
  });
}

/**
 * Performs full pre-checks on an uploaded photo file.
 */
export async function checkPhoto(file: File): Promise<PhotoCheckResult> {
  const warnings: string[] = [];

  // 1. Check MIME type (Hard Error)
  const isAllowedMime =
    ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) ||
    /\.(jpe?g|png|webp|avif)$/i.test(file.name);

  if (!isAllowedMime) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a JPG, PNG, or WebP photo.",
      warnings: [],
      width: 0,
      height: 0,
      blurScore: 0,
      brightness: 0,
    };
  }

  // 2. Check File Size (Hard Error)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Photo is too large (${sizeMB} MB). Maximum allowed size is 50 MB.`,
      warnings: [],
      width: 0,
      height: 0,
      blurScore: 0,
      brightness: 0,
    };
  }

  // 3. Load Image to inspect pixel dimensions
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(file);
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || "Failed to decode photo.",
      warnings: [],
      width: 0,
      height: 0,
      blurScore: 0,
      brightness: 0,
    };
  }

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (width <= 0 || height <= 0) {
    return {
      valid: false,
      error: "Unable to determine photo dimensions. Please upload a valid image file.",
      warnings: [],
      width: 0,
      height: 0,
      blurScore: 0,
      brightness: 0,
    };
  }

  // 4. Sample image on an offscreen canvas for blur and brightness analysis
  // Scale down proportionally to a max dimension of 400px for high performance
  const maxDim = 400;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const sampleW = Math.max(10, Math.round(width * scale));
  const sampleH = Math.max(10, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    // If 2d context unavailable, return valid without blur/brightness metrics
    return {
      valid: true,
      warnings,
      width,
      height,
      blurScore: 100,
      brightness: 128,
    };
  }

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;
  const totalPixels = sampleW * sampleH;

  // Convert to grayscale & compute mean brightness
  const gray = new Float32Array(totalPixels);
  let brightnessSum = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Luminance formula
    const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = yVal;
    brightnessSum += yVal;
  }

  const meanBrightness = brightnessSum / totalPixels;

  // 5. Blur Detection: Variance of the Laplacian
  // Kernel:
  // [ 0,  1,  0 ]
  // [ 1, -4,  1 ]
  // [ 0,  1,  0 ]
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let interiorPixelCount = 0;

  for (let y = 1; y < sampleH - 1; y++) {
    const rowOffset = y * sampleW;
    const prevRowOffset = (y - 1) * sampleW;
    const nextRowOffset = (y + 1) * sampleW;

    for (let x = 1; x < sampleW - 1; x++) {
      const center = gray[rowOffset + x];
      const top = gray[prevRowOffset + x];
      const bottom = gray[nextRowOffset + x];
      const left = gray[rowOffset + x - 1];
      const right = gray[rowOffset + x + 1];

      const laplacian = top + bottom + left + right - 4 * center;
      laplacianSum += laplacian;
      laplacianSumSq += laplacian * laplacian;
      interiorPixelCount++;
    }
  }

  const meanLaplacian = interiorPixelCount > 0 ? laplacianSum / interiorPixelCount : 0;
  const varianceLaplacian =
    interiorPixelCount > 0
      ? laplacianSumSq / interiorPixelCount - meanLaplacian * meanLaplacian
      : 0;

  // Evaluate blur
  if (varianceLaplacian < LAPLACIAN_BLUR_THRESHOLD) {
    warnings.push(
      `Photo appears blurry (sharpness score: ${Math.round(varianceLaplacian)}). For best results, use a sharp, focused portrait.`
    );
  }

  // Evaluate brightness
  if (meanBrightness < DARK_BRIGHTNESS_THRESHOLD) {
    warnings.push(
      `Photo appears very dark or underexposed (brightness: ${Math.round(meanBrightness)}/255). Facial details may be lost.`
    );
  } else if (meanBrightness > OVEREXPOSED_BRIGHTNESS_THRESHOLD) {
    warnings.push(
      `Photo appears overexposed or too bright (brightness: ${Math.round(meanBrightness)}/255). Highlights may be washed out.`
    );
  }

  return {
    valid: true,
    warnings,
    width,
    height,
    blurScore: Math.round(varianceLaplacian * 10) / 10,
    brightness: Math.round(meanBrightness),
  };
}
