import type { ImageRecord } from "@/core/storage/models";

export interface LibraryStore {
  addImage(record: ImageRecord, original: Blob, thumbnail: Blob): Promise<void>;
  listImages(): Promise<ImageRecord[]>;
  getImage(id: string): Promise<ImageRecord | undefined>;
  getOriginal(id: string): Promise<Blob | undefined>;
  getThumbnail(id: string): Promise<Blob | undefined>;
  deleteImage(id: string): Promise<void>;
}

export class StorageQuotaError extends Error {
  constructor() {
    super("There is not enough browser storage to save this image.");
    this.name = "StorageQuotaError";
  }
}
