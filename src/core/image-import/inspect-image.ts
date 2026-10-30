import {
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_HEADER_BYTES,
  validateFileLimits,
} from "@/core/limits";

export type SupportedImageFormat = "jpeg" | "png" | "webp";

export interface ImageHeader {
  format: SupportedImageFormat;
  mimeType: string;
  width: number;
  height: number;
}

export type ImageInspectionErrorCode =
  | "tooLarge"
  | "unsupportedFormat"
  | "invalidMagic"
  | "malformedHeader"
  | "tooManyPixels"
  | "impossibleDimension";

export class ImageInspectionError extends Error {
  constructor(
    readonly code: ImageInspectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImageInspectionError";
  }
}

export async function inspectImage(file: Blob): Promise<ImageHeader> {
  if (file.size === 0) {
    throw new ImageInspectionError("malformedHeader", "The file is empty.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ImageInspectionError(
      "tooLarge",
      `This image is larger than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const bytes = new Uint8Array(await file.slice(0, MAX_IMAGE_HEADER_BYTES).arrayBuffer());
  const detected = detectFormat(bytes);
  if (!detected) {
    if (isHeifOrAvif(bytes)) {
      throw new ImageInspectionError(
        "unsupportedFormat",
        "HEIC and AVIF images are not supported yet.",
      );
    }
    throw new ImageInspectionError(
      "invalidMagic",
      "This file is not a supported JPEG, PNG, or WebP image.",
    );
  }

  const dimensions = readDimensions(bytes, detected);
  const errors = validateFileLimits(file.size, dimensions.width, dimensions.height);
  if (errors.length > 0) {
    const error = errors[0];
    if (!error) {
      throw new Error("Image limit validation returned an empty error.");
    }
    switch (error.kind) {
      case "tooLarge":
        throw new ImageInspectionError(
          "tooLarge",
          `This image is larger than ${error.maxBytes / (1024 * 1024)} MB.`,
        );
      case "tooManyPixels":
        throw new ImageInspectionError(
          "tooManyPixels",
          "This image has too many pixels to process safely.",
        );
      case "impossibleDimension":
        throw new ImageInspectionError(
          "impossibleDimension",
          "This image has invalid dimensions.",
        );
    }
  }

  return { ...detected, ...dimensions };
}

function detectFormat(
  bytes: Uint8Array,
): Pick<ImageHeader, "format" | "mimeType"> | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { format: "png", mimeType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: "jpeg", mimeType: "image/jpeg" };
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return { format: "webp", mimeType: "image/webp" };
  }
  return undefined;
}

function readDimensions(
  bytes: Uint8Array,
  format: Pick<ImageHeader, "format">,
): Pick<ImageHeader, "width" | "height"> {
  switch (format.format) {
    case "png":
      return readPngDimensions(bytes);
    case "jpeg":
      return readJpegDimensions(bytes);
    case "webp":
      return readWebpDimensions(bytes);
  }
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") {
    return malformedHeader();
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return malformedHeader();
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      break;
    }
    const segmentLength = (bytes[offset] ?? 0) * 256 + (bytes[offset + 1] ?? 0);
    if (segmentLength < 2) {
      return malformedHeader();
    }
    if (isStartOfFrame(marker)) {
      if (offset + 7 > bytes.length) {
        break;
      }
      return {
        height: (bytes[offset + 3] ?? 0) * 256 + (bytes[offset + 4] ?? 0),
        width: (bytes[offset + 5] ?? 0) * 256 + (bytes[offset + 6] ?? 0),
      };
    }
    offset += segmentLength;
  }
  return malformedHeader();
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 25) {
    return malformedHeader();
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    if (bytes.length < 30) return malformedHeader();
    return {
      width: 1 + readUint24LE(bytes, 24),
      height: 1 + readUint24LE(bytes, 27),
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f || bytes.length < 25) return malformedHeader();
    const b1 = bytes[21] ?? 0;
    const b2 = bytes[22] ?? 0;
    const b3 = bytes[23] ?? 0;
    const b4 = bytes[24] ?? 0;
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
    };
  }
  if (
    chunk === "VP8 " &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: ((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff,
      height: ((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff,
    };
  }
  return malformedHeader();
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function isHeifOrAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") {
    return false;
  }
  const brand = ascii(bytes, 8, 4);
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"].includes(brand);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function malformedHeader(): never {
  throw new ImageInspectionError(
    "malformedHeader",
    "The image header is incomplete or damaged.",
  );
}
