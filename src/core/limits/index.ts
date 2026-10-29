/**
 * Named limits for file validation and processing. Values here are the
 * single source of truth; the UI must never hardcode them.
 *
 * These guards exist to protect the browser from decompression bombs and
 * memory blow-ups (agent.md 9.2). Decoding starts only after the header
 * dimension check passes, so the pixel guard can reject huge files before
 * they are decoded.
 */

/** Maximum accepted input file size in bytes (50 MB). */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum accepted pixel count (100 megapixels) before full decode. */
export const MAX_PIXEL_COUNT = 100_000_000;

/** Maximum width or height allowed on export in pixels. */
export const MAX_EXPORT_DIMENSION = 16_000;

export type FileLimitError =
  | { kind: "tooLarge"; sizeBytes: number; maxBytes: number }
  | { kind: "tooManyPixels"; pixels: number; maxPixels: number }
  | { kind: "impossibleDimension"; dimension: number };

export function validateFileLimits(
  sizeBytes: number,
  width: number,
  height: number,
): FileLimitError[] {
  const errors: FileLimitError[] = [];

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    errors.push({
      kind: "tooLarge",
      sizeBytes,
      maxBytes: MAX_FILE_SIZE_BYTES,
    });
  }

  // Reject impossible dimensions before computing the pixel count.
  for (const dimension of [width, height]) {
    if (
      !Number.isSafeInteger(dimension) ||
      dimension <= 0 ||
      dimension > MAX_EXPORT_DIMENSION
    ) {
      errors.push({
        kind: "impossibleDimension",
        dimension,
      });
      return errors;
    }
  }

  const pixels = width * height;
  if (pixels > MAX_PIXEL_COUNT) {
    errors.push({ kind: "tooManyPixels", pixels, maxPixels: MAX_PIXEL_COUNT });
  }

  return errors;
}

export function isValidFile(sizeBytes: number, width: number, height: number): boolean {
  return validateFileLimits(sizeBytes, width, height).length === 0;
}
