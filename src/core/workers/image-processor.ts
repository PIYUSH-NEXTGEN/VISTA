import * as Comlink from "comlink";
import * as exifr from "exifr";
import { inspectImage } from "@/core/image-import/inspect-image";
import { renderEditStack } from "@/core/edit-stack/render";
import { findBestQuality } from "@/core/image-ops/target-size";
import type {
  CanvasOutput,
  CollageOptions,
  EncodedImage,
  ImageAnalysis,
  ImageProcessorApi,
  ImageProcessProgress,
  ProcessedImage,
} from "@/core/workers/image-processor-types";

const THUMBNAIL_MAX_EDGE = 320;
const THUMBNAIL_QUALITY = 0.82;

export function createImageProcessor(): ImageProcessorApi {
  const cancelledJobs = new Set<string>();

  return {
    renderEdits(source, steps) {
      return renderEditStack(source, { version: 1, steps });
    },
    encodeImage(source, mimeType, quality, targetBytes) {
      return encodeImage(source, mimeType, quality, targetBytes);
    },
    analyzeImage(source, width, height) {
      return analyzeImage(source, width, height);
    },
    createProfile(source, width, height, mask) {
      return createProfile(source, width, height, mask);
    },
    createCollage(sources, options) {
      return createCollage(sources, options);
    },
    cancelJob(jobId) {
      cancelledJobs.add(jobId);
    },
    async processImage(file, jobId, reportProgress) {
      const report = async (stage: ImageProcessProgress["stage"], percent: number) => {
        assertNotCancelled(cancelledJobs, jobId);
        await reportProgress({ stage, percent });
      };

      try {
        await report("validating", 10);
        const header = await inspectImage(file);
        await report("metadata", 25);
        const metadata = await readMetadata(file);
        await report("hashing", 45);
        const contentHash = await hashFile(file);
        await report("thumbnail", 65);
        const thumbnail = await createThumbnail(file);
        await report("thumbnail", 100);

        const processed: ProcessedImage = {
          ...header,
          contentHash,
          thumbnail,
          ...metadata,
        };
        return thumbnail.kind === "bitmap"
          ? Comlink.transfer(processed, [thumbnail.bitmap])
          : processed;
      } finally {
        cancelledJobs.delete(jobId);
      }
    },
  };
}

async function createProfile(
  source: Blob,
  width: number,
  height: number,
  mask: "circle" | "square",
): Promise<CanvasOutput> {
  const canvas = requireOffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the profile image surface.");
  if (mask === "circle") {
    context.beginPath();
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.clip();
  } else {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  await drawCover(context, source, 0, 0, width, height);
  const blob = await canvas.convertToBlob({
    type: mask === "circle" ? "image/png" : "image/jpeg",
    quality: 0.92,
  });
  return { blob, width, height };
}

async function createCollage(
  sources: Blob[],
  options: CollageOptions,
): Promise<CanvasOutput> {
  if (sources.length === 0) throw new Error("Choose at least one photo for the collage.");
  if (sources.length > 100)
    throw new Error("A collage or contact sheet can include at most 100 photos.");
  const columns = Math.max(1, Math.min(Math.floor(options.columns), sources.length));
  const gap = Math.max(0, Math.min(100, Math.floor(options.gap)));
  const rows = Math.ceil(sources.length / columns);
  const height = rows * options.cellHeight + (rows + 1) * gap;
  const canvas = requireOffscreenCanvas(options.width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the collage surface.");
  context.fillStyle = options.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const cellWidth = (options.width - (columns + 1) * gap) / columns;
  if (cellWidth < 1) throw new Error("The selected spacing is too large for this layout.");
  for (const [index, source] of sources.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    await drawCover(
      context,
      source,
      gap + column * (cellWidth + gap),
      gap + row * (options.cellHeight + gap),
      cellWidth,
      options.cellHeight,
    );
  }
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  return { blob, width: canvas.width, height: canvas.height };
}

async function drawCover(
  context: OffscreenCanvasRenderingContext2D,
  source: Blob,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sx = (bitmap.width - sourceWidth) / 2;
    const sy = (bitmap.height - sourceHeight) / 2;
    context.drawImage(bitmap, sx, sy, sourceWidth, sourceHeight, x, y, width, height);
  } finally {
    bitmap.close();
  }
}

function requireOffscreenCanvas(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas === "undefined")
    throw new Error("Image creation needs worker canvas support in this browser.");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16_000 ||
    height > 16_000 ||
    width * height > 100_000_000
  )
    throw new Error("The requested image dimensions exceed the supported export limits.");
  return new OffscreenCanvas(width, height);
}

async function analyzeImage(
  source: Blob,
  sourceWidth: number,
  sourceHeight: number,
): Promise<ImageAnalysis> {
  if (typeof OffscreenCanvas === "undefined")
    throw new Error("Photo analysis needs worker canvas support in this browser.");
  const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
  const bitmap = await createImageBitmap(source, {
    resizeWidth: Math.max(1, Math.round(sourceWidth * scale)),
    resizeHeight: Math.max(1, Math.round(sourceHeight * scale)),
    resizeQuality: "high",
  });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create the photo analysis surface.");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const gray = new Float32Array(bitmap.width * bitmap.height);
    let brightness = 0;
    for (let i = 0; i < gray.length; i += 1) {
      const offset = i * 4;
      const value =
        0.2126 * (data[offset] ?? 0) +
        0.7152 * (data[offset + 1] ?? 0) +
        0.0722 * (data[offset + 2] ?? 0);
      gray[i] = value;
      brightness += value;
    }
    let laplacianSum = 0;
    let laplacianSquared = 0;
    let count = 0;
    for (let y = 1; y < bitmap.height - 1; y += 1) {
      for (let x = 1; x < bitmap.width - 1; x += 1) {
        const i = y * bitmap.width + x;
        const laplacian =
          (gray[i - 1] ?? 0) +
          (gray[i + 1] ?? 0) +
          (gray[i - bitmap.width] ?? 0) +
          (gray[i + bitmap.width] ?? 0) -
          4 * (gray[i] ?? 0);
        laplacianSum += laplacian;
        laplacianSquared += laplacian * laplacian;
        count += 1;
      }
    }
    const mean = laplacianSum / Math.max(count, 1);
    const focusScore = laplacianSquared / Math.max(count, 1) - mean * mean;
    return {
      perceptualHash: differenceHash(gray, bitmap.width, bitmap.height),
      brightness: brightness / gray.length,
      focusScore: Math.max(0, focusScore),
    };
  } finally {
    bitmap.close();
  }
}

function differenceHash(gray: Float32Array, width: number, height: number): string {
  let hash = BigInt(0);
  for (let y = 0; y < 8; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / 8));
    for (let x = 0; x < 8; x += 1) {
      const leftX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / 9));
      const rightX = Math.min(width - 1, Math.floor(((x + 1.5) * width) / 9));
      const left = gray[sourceY * width + leftX] ?? 0;
      const right = gray[sourceY * width + rightX] ?? 0;
      if (left > right) hash |= BigInt(1) << BigInt(y * 8 + x);
    }
  }
  return hash.toString(16).padStart(16, "0");
}

async function encodeImage(
  source: Blob,
  mimeType: string,
  quality: number,
  targetBytes?: number,
): Promise<EncodedImage> {
  if (typeof OffscreenCanvas === "undefined")
    throw new Error("Image conversion needs worker canvas support in this browser.");
  if (!["image/png", "image/jpeg", "image/webp", "image/avif"].includes(mimeType))
    throw new Error("This output format is not supported.");
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create an image conversion surface.");
    if (mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    let chosenQuality = Math.max(0.05, Math.min(1, quality));
    let blob = await canvas.convertToBlob({ type: mimeType, quality: chosenQuality });
    if (blob.type !== mimeType)
      throw new Error(
        `${mimeType.replace("image/", "").toUpperCase()} encoding is not supported by this browser.`,
      );
    if (targetBytes !== undefined) {
      const best = await findBestQuality(targetBytes, async (candidateQuality) => {
        const candidate = await canvas.convertToBlob({
          type: mimeType,
          quality: candidateQuality,
        });
        if (candidate.type !== mimeType)
          throw new Error("This browser cannot encode the selected format.");
        return { value: candidate, sizeBytes: candidate.size };
      });
      chosenQuality = best.quality;
      blob = best.value;
    }
    const thumbScale = Math.min(
      1,
      THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const thumbCanvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * thumbScale)),
      Math.max(1, Math.round(bitmap.height * thumbScale)),
    );
    const thumbContext = thumbCanvas.getContext("2d");
    if (!thumbContext) throw new Error("Could not create the converted thumbnail.");
    thumbContext.drawImage(bitmap, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbnail = await thumbCanvas.convertToBlob({
      type: "image/webp",
      quality: THUMBNAIL_QUALITY,
    });
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return {
      blob,
      thumbnail:
        thumbnail.type === "image/webp"
          ? thumbnail
          : await thumbCanvas.convertToBlob({ type: "image/png" }),
      width: bitmap.width,
      height: bitmap.height,
      contentHash: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
      quality: chosenQuality,
    };
  } finally {
    bitmap.close();
  }
}

interface ExtractedMetadata {
  takenAt?: number;
  orientation?: number;
  camera?: string;
}

async function readMetadata(file: File): Promise<ExtractedMetadata> {
  const parsed: unknown = await exifr.parse(file, {
    pick: ["DateTimeOriginal", "CreateDate", "Orientation", "Make", "Model"],
  });
  if (!isRecord(parsed)) return {};

  const date = normalizeExifDate(parsed.DateTimeOriginal ?? parsed.CreateDate);
  const orientation = parsed.Orientation;
  const make = stringValue(parsed.Make);
  const model = stringValue(parsed.Model);
  const camera = [make, model].filter(Boolean).join(" ");

  return {
    ...(date === undefined ? {} : { takenAt: date }),
    ...(typeof orientation === "number" &&
    Number.isInteger(orientation) &&
    orientation >= 1 &&
    orientation <= 8
      ? { orientation }
      : {}),
    ...(camera.length === 0 ? {} : { camera }),
  };
}

function normalizeExifDate(value: unknown): number | undefined {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})\s/, "$1-$2-$3T");
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function hashFile(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function createThumbnail(file: Blob): Promise<ProcessedImage["thumbnail"]> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (typeof OffscreenCanvas === "undefined") {
      const thumbnailBitmap = await createImageBitmap(bitmap, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: "high",
      });
      return { kind: "bitmap", bitmap: thumbnailBitmap };
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create an image preview canvas.");
    }
    context.drawImage(bitmap, 0, 0, width, height);

    const thumbnail = await canvas.convertToBlob({
      type: "image/webp",
      quality: THUMBNAIL_QUALITY,
    });
    if (thumbnail.type === "image/webp") return { kind: "blob", blob: thumbnail };
    return { kind: "blob", blob: await canvas.convertToBlob({ type: "image/png" }) };
  } finally {
    bitmap.close();
  }
}

function assertNotCancelled(cancelledJobs: Set<string>, jobId: string): void {
  if (cancelledJobs.has(jobId)) {
    throw new DOMException("The job was cancelled.", "AbortError");
  }
}
