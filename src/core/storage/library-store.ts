import type {
  AlbumRecord,
  EditRecord,
  ImageQualityMetrics,
  ImageRecord,
} from "@/core/storage/models";

export interface AlbumSummary {
  album: AlbumRecord;
  /** Count of live (not trashed) images in the album. */
  imageCount: number;
}

export interface LibraryStore {
  addImage(record: ImageRecord, original: Blob, thumbnail: Blob): Promise<void>;
  /** Live images (never trashed) newest import first. */
  listImages(): Promise<ImageRecord[]>;
  getImage(id: string): Promise<ImageRecord | undefined>;
  getOriginal(id: string): Promise<Blob | undefined>;
  getThumbnail(id: string): Promise<Blob | undefined>;
  saveImageAnalysis(
    id: string,
    perceptualHash: string,
    quality: ImageQualityMetrics,
  ): Promise<void>;
  getEdit(id: string): Promise<EditRecord | undefined>;
  saveEdit(edit: EditRecord): Promise<void>;
  /** Removes an image and every related row in one transaction. */
  deleteImage(id: string): Promise<void>;

  /* Trash flow */
  trashImages(ids: string[]): Promise<void>;
  restoreImages(ids: string[]): Promise<void>;
  listTrash(): Promise<ImageRecord[]>;
  /** Permanently removes the given images (and their related rows) in one transaction. */
  purgeImages(ids: string[]): Promise<void>;
  emptyTrash(): Promise<number>;

  /* Settings (schema `settings` store) */
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<void>;

  /* Albums */
  listAlbums(): Promise<AlbumSummary[]>;
  listAlbumImages(albumId: string): Promise<ImageRecord[]>;
  createAlbum(name: string): Promise<AlbumRecord>;
  renameAlbum(albumId: string, name: string): Promise<void>;
  deleteAlbum(albumId: string): Promise<void>;
  addImagesToAlbum(albumId: string, imageIds: string[]): Promise<void>;
  removeImagesFromAlbum(albumId: string, imageIds: string[]): Promise<void>;
  /** Moves one image to a new position (0-based) inside the album's order. */
  reorderAlbumItem(albumId: string, imageId: string, position: number): Promise<void>;
  setAlbumCover(albumId: string, imageId: string): Promise<void>;
}

export class StorageQuotaError extends Error {
  constructor() {
    super("There is not enough browser storage to save this image.");
    this.name = "StorageQuotaError";
  }
}

export class AlbumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlbumError";
  }
}
