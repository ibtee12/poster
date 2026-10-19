export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export type SupportedImageFormat = "png" | "jpeg" | "webp";

export function detectImageFormat(buffer: Buffer): SupportedImageFormat | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

export function validateImageBuffer(
  buffer: Buffer,
  maxSizeBytes: number = MAX_IMAGE_FILE_SIZE
): { valid: boolean; format?: SupportedImageFormat; mimeType?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Image buffer is empty" };
  }

  if (buffer.length > maxSizeBytes) {
    const mbLimit = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Image exceeds maximum allowed size of ${mbLimit} MB`,
    };
  }

  const format = detectImageFormat(buffer);
  if (!format) {
    return {
      valid: false,
      error: "Invalid image format. Allowed formats: PNG, JPEG, WebP.",
    };
  }

  const mimeMap: Record<SupportedImageFormat, string> = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  return {
    valid: true,
    format,
    mimeType: mimeMap[format],
  };
}
