export interface ImageRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  importedAt: number;
  takenAt?: number;
  contentHash: string;
  orientation?: number;
  camera?: string;
  /** Unix ms when the image moved to trash; absent while it lives in the library. */
  deletedAt?: number;
  /** Cached perceptual hash and quality metrics populated by library analysis. */
  perceptualHash?: string;
  quality?: ImageQualityMetrics;
}

export interface ImageQualityMetrics {
  brightness: number;
  focusScore: number;
  analyzedAt: number;
}

export interface ImageBlobRecord {
  id: string;
  blob: Blob | ArrayBuffer;
  mimeType: string;
}

export interface ThumbnailRecord {
  id: string;
  blob: Blob | ArrayBuffer;
  mimeType: string;
}

export interface AlbumRecord {
  id: string;
  name: string;
  coverImageId?: string;
  createdAt: number;
}

export interface AlbumItemRecord {
  albumId: string;
  imageId: string;
  sortOrder: number;
}

export interface EditRecord {
  imageId: string;
  steps: unknown[];
  cachedRender?: Blob;
}

export interface OcrRecord {
  imageId: string;
  text: string;
  language: string;
  confidence?: number;
}

export interface VectorRecord {
  imageId: string;
  embedding: number[];
}

export interface SettingRecord {
  key: string;
  value: unknown;
}
