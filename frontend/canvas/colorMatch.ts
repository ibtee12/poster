/**
 * lib/colorMatch.ts
 * Look Matching:
 * Subtly adjusts brightness and warmth of a cutout toward the template background's
 * average color tone, harmonizing the subject with the poster aesthetic.
 * - Limited to a small, subtle range (default max 10-12% shift).
 * - Per-template on/off setting.
 */

export interface ColorMatchOptions {
  /** Maximum adjustment factor (0 to 1, default 0.12 = 12% max shift) */
  maxFactor?: number;
}

/**
 * Computes average RGB from an image source on an offscreen canvas.
 * For cutouts, only non-transparent pixels (alpha > 40) are included.
 */
function getAverageColor(
  source: CanvasImageSource,
  onlyOpaque = false
): { r: number; g: number; b: number; count: number } {
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 80;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { r: 128, g: 128, b: 128, count: 0 };

  ctx.drawImage(source, 0, 0, 80, 80);
  const imgData = ctx.getImageData(0, 0, 80, 80);
  const data = imgData.data;

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (onlyOpaque && a < 40) continue;

    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  }

  if (count === 0) return { r: 128, g: 128, b: 128, count: 0 };
  return {
    r: rSum / count,
    g: gSum / count,
    b: bSum / count,
    count,
  };
}

/**
 * Adjusts brightness and warmth of the cutout to subtly match the template background.
 */
export function matchCutoutColors(
  cutout: CanvasImageSource,
  blankImage: CanvasImageSource,
  options?: ColorMatchOptions
): HTMLCanvasElement {
  const maxFactor = options?.maxFactor ?? 0.12; // 12% max adjustment

  const cWidth =
    (cutout as HTMLImageElement).naturalWidth ||
    (cutout as HTMLCanvasElement).width ||
    (cutout as ImageBitmap).width ||
    1;
  const cHeight =
    (cutout as HTMLImageElement).naturalHeight ||
    (cutout as HTMLCanvasElement).height ||
    (cutout as ImageBitmap).height ||
    1;

  // 1. Compute template background average tone
  const bgAvg = getAverageColor(blankImage, false);
  const bgWarmth = (bgAvg.r - bgAvg.b) / 255; // positive = warm, negative = cool
  const bgBrightness = (0.299 * bgAvg.r + 0.587 * bgAvg.g + 0.114 * bgAvg.b) / 255;

  // 2. Compute cutout average tone
  const cutAvg = getAverageColor(cutout, true);
  const cutWarmth = (cutAvg.r - cutAvg.b) / 255;
  const cutBrightness = (0.299 * cutAvg.r + 0.587 * cutAvg.g + 0.114 * cutAvg.b) / 255;

  // 3. Compute delta shift clamped to subtle threshold
  const deltaWarmth = Math.max(-0.15, Math.min(0.15, bgWarmth - cutWarmth)) * maxFactor;
  const deltaBrightness = Math.max(-0.12, Math.min(0.12, bgBrightness - cutBrightness)) * maxFactor;

  // 4. Apply shift to cutout canvas
  const canvas = document.createElement("canvas");
  canvas.width = cWidth;
  canvas.height = cHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(cutout, 0, 0, cWidth, cHeight);
  const imgData = ctx.getImageData(0, 0, cWidth, cHeight);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Warmth shifts R up, B down (or vice versa)
    // Brightness scales overall luminance
    const rNew = Math.min(255, Math.max(0, Math.round(r * (1 + deltaWarmth) * (1 + deltaBrightness))));
    const gNew = Math.min(255, Math.max(0, Math.round(g * (1 + deltaBrightness))));
    const bNew = Math.min(255, Math.max(0, Math.round(b * (1 - deltaWarmth) * (1 + deltaBrightness))));

    data[i] = rNew;
    data[i + 1] = gNew;
    data[i + 2] = bNew;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
