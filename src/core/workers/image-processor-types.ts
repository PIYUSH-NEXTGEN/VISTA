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
  renderEdits(
    source: Blob,
    steps: unknown[],
  ): Promise<{
    rendered: Blob;
    thumbnail: Blob;
    width: number;
    height: number;
    contentHash: string;
  }>;
  encodeImage(
    source: Blob,
    mimeType: string,
    quality: number,
    targetBytes?: number,
  ): Promise<EncodedImage>;
  analyzeImage(source: Blob, width: number, height: number): Promise<ImageAnalysis>;
  createProfile(
    source: Blob,
    width: number,
    height: number,
    mask: "circle" | "square",
  ): Promise<CanvasOutput>;
  createCollage(sources: Blob[], options: CollageOptions): Promise<CanvasOutput>;
}

export interface EncodedImage {
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  contentHash: string;
  quality: number;
}

export interface ImageAnalysis {
  perceptualHash: string;
  brightness: number;
  focusScore: number;
}

export interface CanvasOutput {
  blob: Blob;
  width: number;
  height: number;
}

export interface CollageOptions {
  width: number;
  cellHeight: number;
  columns: number;
  gap: number;
  background: string;
}
