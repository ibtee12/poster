/**
 * lib/cutoutClean.ts
 * Edge cleanup and post-processing for person cutouts:
 * 1. Remove stray semi-transparent pixels.
 * 2. Remove small isolated floating blobs (connected component analysis).
 * 3. Erode alpha mask by 1px to eliminate color fringing and edge halos.
 * 4. Feather alpha mask by 1px for smooth, anti-aliased contours.
 * Tunable constants exposed at top level and via configuration parameter.
 */

export interface CutoutCleanConfig {
  /** Alpha values below this are set to 0 (clears stray semi-transparent artifacts) */
  lowAlphaCutoff: number;
  /** Alpha values above this are clamped to 255 (solid interior) */
  highAlphaCutoff: number;
  /** Number of erosion pixels to shave off outer fringing (default 1) */
  erodePixels: number;
  /** Radius in pixels for edge feathering (default 1) */
  featherRadius: number;
  /** Minimum pixel count for connected components; smaller islands are removed */
  minBlobPixelCount: number;
}

export const DEFAULT_CLEAN_CONFIG: CutoutCleanConfig = {
  lowAlphaCutoff: 30,
  highAlphaCutoff: 235,
  erodePixels: 1,
  featherRadius: 1,
  minBlobPixelCount: 150,
};

/**
 * Cleans the edges and isolates the main subject of a cutout image.
 */
export function cleanCutout(
  source: CanvasImageSource,
  customConfig?: Partial<CutoutCleanConfig>
): HTMLCanvasElement {
  const config: CutoutCleanConfig = {
    ...DEFAULT_CLEAN_CONFIG,
    ...customConfig,
  };

  const width =
    (source as HTMLImageElement).naturalWidth ||
    (source as HTMLCanvasElement).width ||
    (source as ImageBitmap).width ||
    1;
  const height =
    (source as HTMLImageElement).naturalHeight ||
    (source as HTMLCanvasElement).height ||
    (source as ImageBitmap).height ||
    1;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) return canvas;

  ctx.drawImage(source, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // -------------------------------------------------------------
  // Step 1: Remove stray semi-transparent pixels
  // -------------------------------------------------------------
  for (let i = 0; i < totalPixels; i++) {
    const aIdx = i * 4 + 3;
    const alpha = data[aIdx];
    if (alpha < config.lowAlphaCutoff) {
      data[aIdx] = 0;
    } else if (alpha > config.highAlphaCutoff) {
      data[aIdx] = 255;
    }
  }

  // -------------------------------------------------------------
  // Step 2: Remove small isolated floating blobs (Connected Components)
  // -------------------------------------------------------------
  const visited = new Uint8Array(totalPixels);
  const componentLabels = new Int32Array(totalPixels);
  componentLabels.fill(-1);

  let currentComponentId = 0;
  const componentSizes: number[] = [];

  // Queue for Breadth-First-Search flood fill
  const queueX = new Int32Array(totalPixels);
  const queueY = new Int32Array(totalPixels);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (data[idx * 4 + 3] > 0 && !visited[idx]) {
        // Start BFS flood-fill for this new component
        const compId = currentComponentId++;
        let compSize = 0;
        let qHead = 0;
        let qTail = 0;

        queueX[qTail] = x;
        queueY[qTail] = y;
        qTail++;
        visited[idx] = 1;
        componentLabels[idx] = compId;

        while (qHead < qTail) {
          const cx = queueX[qHead];
          const cy = queueY[qHead];
          qHead++;
          compSize++;

          // 4-neighborhood
          const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];

          for (let n = 0; n < 4; n++) {
            const nx = neighbors[n][0];
            const ny = neighbors[n][1];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (data[nIdx * 4 + 3] > 0 && !visited[nIdx]) {
                visited[nIdx] = 1;
                componentLabels[nIdx] = compId;
                queueX[qTail] = nx;
                queueY[qTail] = ny;
                qTail++;
              }
            }
          }
        }

        componentSizes.push(compSize);
      }
    }
  }

  // Find max component (the person)
  let maxCompSize = 0;
  for (let s of componentSizes) {
    if (s > maxCompSize) maxCompSize = s;
  }

  // Remove components that are smaller than minBlobPixelCount AND less than 3% of largest
  const sizeThreshold = Math.max(config.minBlobPixelCount, Math.round(maxCompSize * 0.03));
  for (let i = 0; i < totalPixels; i++) {
    const compId = componentLabels[i];
    if (compId >= 0 && componentSizes[compId] < sizeThreshold) {
      data[i * 4 + 3] = 0;
    }
  }

  // -------------------------------------------------------------
  // Step 3: Erode alpha mask by erodePixels (1px)
  // -------------------------------------------------------------
  if (config.erodePixels > 0) {
    const currentAlpha = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      currentAlpha[i] = data[i * 4 + 3];
    }

    for (let pass = 0; pass < config.erodePixels; pass++) {
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
          const idx = rowOffset + x;
          if (currentAlpha[idx] === 0) continue;

          // Check if any 4-neighbor is transparent
          const hasTransparentNeighbor =
            x === 0 ||
            x === width - 1 ||
            y === 0 ||
            y === height - 1 ||
            currentAlpha[idx - 1] === 0 ||
            currentAlpha[idx + 1] === 0 ||
            currentAlpha[idx - width] === 0 ||
            currentAlpha[idx + width] === 0;

          if (hasTransparentNeighbor) {
            data[idx * 4 + 3] = 0;
          }
        }
      }

      // Update currentAlpha for next pass if any
      for (let i = 0; i < totalPixels; i++) {
        currentAlpha[i] = data[i * 4 + 3];
      }
    }
  }

  // -------------------------------------------------------------
  // Step 4: Feather alpha mask by featherRadius (1px)
  // -------------------------------------------------------------
  if (config.featherRadius > 0) {
    const currentAlpha = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      currentAlpha[i] = data[i * 4 + 3];
    }

    const r = config.featherRadius;
    for (let y = r; y < height - r; y++) {
      const rowOffset = y * width;
      for (let x = r; x < width - r; x++) {
        const idx = rowOffset + x;
        const selfAlpha = currentAlpha[idx];

        // Only feather near boundaries (where alpha is partially transparent or has a transparent neighbor)
        const isNearEdge =
          selfAlpha > 0 &&
          (selfAlpha < 250 ||
            currentAlpha[idx - 1] === 0 ||
            currentAlpha[idx + 1] === 0 ||
            currentAlpha[idx - width] === 0 ||
            currentAlpha[idx + width] === 0);

        if (isNearEdge) {
          let sum = 0;
          let count = 0;
          for (let dy = -r; dy <= r; dy++) {
            const nyOffset = (y + dy) * width;
            for (let dx = -r; dx <= r; dx++) {
              sum += currentAlpha[nyOffset + x + dx];
              count++;
            }
          }
          data[idx * 4 + 3] = Math.round(sum / count);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
