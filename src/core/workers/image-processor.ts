import * as Comlink from "comlink";
import * as exifr from "exifr";
import { inspectImage } from "@/core/image-import/inspect-image";
import type {
  ImageProcessorApi,
  ImageProcessProgress,
  ProcessedImage,
} from "@/core/workers/image-processor-types";

const THUMBNAIL_MAX_EDGE = 320;
const THUMBNAIL_QUALITY = 0.82;

export function createImageProcessor(): ImageProcessorApi {
  const cancelledJobs = new Set<string>();

  return {
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
