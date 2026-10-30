export interface ImageProcessProgress {
  stage: "validating" | "metadata" | "hashing" | "thumbnail";
  percent: number;
}

export interface ProcessedImage {
  format: "jpeg" | "png" | "webp";
  mimeType: string;
  width: number;
  height: number;
  contentHash: string;
  thumbnail: ThumbnailData;
  takenAt?: number;
  orientation?: number;
  camera?: string;
}

export type ThumbnailData =
  { kind: "blob"; blob: Blob } | { kind: "bitmap"; bitmap: ImageBitmap };

export type ImageProgressCallback = (progress: ImageProcessProgress) => void;

export interface ImageProcessorApi {
  processImage(
    file: File,
    jobId: string,
    reportProgress: ImageProgressCallback,
  ): Promise<ProcessedImage>;
  cancelJob(jobId: string): void;
}
