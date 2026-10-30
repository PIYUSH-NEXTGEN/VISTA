import { getVistaDatabase, type VistaDatabase } from "@/core/storage/database";
import type { ImageBlobRecord, ImageRecord, ThumbnailRecord } from "@/core/storage/models";
import { StorageQuotaError, type LibraryStore } from "@/core/storage/library-store";

export class DexieLibraryStore implements LibraryStore {
  constructor(private readonly database: VistaDatabase = getVistaDatabase()) {}

  async addImage(record: ImageRecord, original: Blob, thumbnail: Blob): Promise<void> {
    try {
      await this.writeImageRows(
        record,
        { id: record.id, blob: original, mimeType: record.mimeType },
        { id: record.id, blob: thumbnail, mimeType: thumbnail.type },
      );
    } catch (error) {
      if (isQuotaExceeded(error)) {
        throw new StorageQuotaError();
      }
      if (!isBlobSerializationError(error)) {
        throw new Error("The browser could not save this image to local storage.", {
          cause: error,
        });
      }

      try {
        await this.writeImageRows(
          record,
          {
            id: record.id,
            blob: await original.arrayBuffer(),
            mimeType: record.mimeType,
          },
          {
            id: record.id,
            blob: await thumbnail.arrayBuffer(),
            mimeType: thumbnail.type,
          },
        );
      } catch (retryError) {
        if (isQuotaExceeded(retryError)) {
          throw new StorageQuotaError();
        }
        throw new Error("The browser could not save this image to local storage.", {
          cause: retryError,
        });
      }
    }
  }

  listImages(): Promise<ImageRecord[]> {
    return this.database.images.orderBy("importedAt").reverse().toArray();
  }

  getImage(id: string): Promise<ImageRecord | undefined> {
    return this.database.images.get(id);
  }

  async getOriginal(id: string): Promise<Blob | undefined> {
    const stored = await this.database.blobs.get(id);
    if (!stored) return undefined;
    if (stored.blob instanceof ArrayBuffer) {
      return new Blob([stored.blob], { type: stored.mimeType });
    }
    return stored.blob;
  }

  async getThumbnail(id: string): Promise<Blob | undefined> {
    const stored = await this.database.thumbs.get(id);
    if (!stored) return undefined;
    if (stored.blob instanceof ArrayBuffer) {
      return new Blob([stored.blob], { type: stored.mimeType });
    }
    return stored.blob;
  }

  async deleteImage(id: string): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.images,
        this.database.blobs,
        this.database.thumbs,
        this.database.albumItems,
        this.database.edits,
        this.database.ocr,
        this.database.vectors,
      ],
      async () => {
        await Promise.all([
          this.database.images.delete(id),
          this.database.blobs.delete(id),
          this.database.thumbs.delete(id),
          this.database.edits.delete(id),
          this.database.ocr.delete(id),
          this.database.vectors.delete(id),
          this.database.albumItems.where("imageId").equals(id).delete(),
        ]);
      },
    );
  }

  private writeImageRows(
    record: ImageRecord,
    original: ImageBlobRecord,
    thumbnail: ThumbnailRecord,
  ): Promise<void> {
    return this.database.transaction(
      "rw",
      this.database.images,
      this.database.blobs,
      this.database.thumbs,
      async () => {
        await this.database.images.add(record);
        await this.database.blobs.add(original);
        await this.database.thumbs.add(thumbnail);
      },
    );
  }
}

function isQuotaExceeded(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "QuotaExceededError"
  );
}

function isBlobSerializationError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (
      current instanceof Error &&
      current.message.includes("Error preparing Blob/File data to be stored")
    ) {
      return true;
    }
    if (typeof current !== "object" || current === null || !("cause" in current)) {
      return false;
    }
    current = current.cause;
  }
  return false;
}
