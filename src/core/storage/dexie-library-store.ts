import { getVistaDatabase, type VistaDatabase } from "@/core/storage/database";
import type {
  AlbumRecord,
  ImageQualityMetrics,
  ImageBlobRecord,
  ImageRecord,
  ThumbnailRecord,
} from "@/core/storage/models";
import {
  AlbumError,
  StorageQuotaError,
  type AlbumSummary,
  type LibraryStore,
} from "@/core/storage/library-store";

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
    return this.database.images
      .orderBy("importedAt")
      .reverse()
      .filter((image) => image.deletedAt === undefined)
      .toArray();
  }

  getImage(id: string): Promise<ImageRecord | undefined> {
    return this.database.images.get(id);
  }

  async getOriginal(id: string): Promise<Blob | undefined> {
    const stored = await this.database.blobs.get(id);
    return stored === undefined ? undefined : storedBlob(stored.blob, stored.mimeType);
  }

  async getThumbnail(id: string): Promise<Blob | undefined> {
    const stored = await this.database.thumbs.get(id);
    return stored === undefined ? undefined : storedBlob(stored.blob, stored.mimeType);
  }

  async saveImageAnalysis(
    id: string,
    perceptualHash: string,
    quality: ImageQualityMetrics,
  ): Promise<void> {
    await this.database.images.update(id, { perceptualHash, quality });
  }

  getEdit(id: string) {
    return this.database.edits.get(id);
  }

  async saveEdit(edit: {
    imageId: string;
    steps: unknown[];
    cachedRender?: Blob;
  }): Promise<void> {
    await this.database.edits.put(edit);
  }

  deleteImage(id: string): Promise<void> {
    return this.purgeImages([id]);
  }

  /* Trash flow */

  async trashImages(ids: string[]): Promise<void> {
    const trashedAt = Date.now();
    await this.database.transaction("rw", this.database.images, async () => {
      for (const id of ids) {
        const image = await this.database.images.get(id);
        if (image && image.deletedAt === undefined) {
          await this.database.images.update(id, { deletedAt: trashedAt });
        }
      }
    });
  }

  async restoreImages(ids: string[]): Promise<void> {
    await this.database.transaction("rw", this.database.images, async () => {
      for (const id of ids) {
        const image = await this.database.images.get(id);
        if (image && image.deletedAt !== undefined) {
          await removeDeletedAt(this.database, id);
        }
      }
    });
  }

  listTrash(): Promise<ImageRecord[]> {
    return this.database.images.where("deletedAt").above(0).reverse().toArray();
  }

  async emptyTrash(): Promise<number> {
    return this.database.transaction(
      "rw",
      [
        this.database.images,
        this.database.blobs,
        this.database.thumbs,
        this.database.albumItems,
        this.database.edits,
        this.database.ocr,
        this.database.vectors,
        this.database.albums,
      ],
      async () => {
        const ids = await this.database.images.where("deletedAt").above(0).primaryKeys();
        for (const id of ids) {
          await deleteImageRows(this.database, String(id));
        }
        await repairAlbumCovers(this.database, new Set(ids.map(String)));
        return ids.length;
      },
    );
  }

  /** Permanent removal of the given images, everything related, in one transaction. */
  purgeImages(ids: string[]): Promise<void> {
    return this.database.transaction(
      "rw",
      [
        this.database.images,
        this.database.blobs,
        this.database.thumbs,
        this.database.albumItems,
        this.database.edits,
        this.database.ocr,
        this.database.vectors,
        this.database.albums,
      ],
      async () => {
        for (const id of ids) {
          await deleteImageRows(this.database, id);
        }
        await repairAlbumCovers(this.database, new Set(ids));
      },
    );
  }

  getSetting(key: string): Promise<unknown> {
    return this.database.settings
      .get(key)
      .then((row) => (row === undefined ? undefined : row.value));
  }

  setSetting(key: string, value: unknown): Promise<void> {
    return this.database.settings.put({ key, value }).then(() => undefined);
  }

  /* Albums */

  async listAlbums(): Promise<AlbumSummary[]> {
    const [albums, items, liveImageIds] = await Promise.all([
      this.database.albums.orderBy("createdAt").toArray(),
      this.database.albumItems.toArray(),
      this.database.images
        .toCollection()
        .filter((image) => image.deletedAt === undefined)
        .primaryKeys()
        .then((keys) => new Set(keys.map(String))),
    ]);
    const counts = new Map<string, number>();
    for (const item of items) {
      if (liveImageIds.has(item.imageId)) {
        counts.set(item.albumId, (counts.get(item.albumId) ?? 0) + 1);
      }
    }
    return albums.map((album) => ({
      album,
      imageCount: counts.get(album.id) ?? 0,
    }));
  }

  async listAlbumImages(albumId: string): Promise<ImageRecord[]> {
    const items = await this.database.albumItems
      .where("albumId")
      .equals(albumId)
      .sortBy("sortOrder");
    const images = await this.database.images.bulkGet(items.map((item) => item.imageId));
    return images.filter(
      (image): image is ImageRecord => image !== undefined && image.deletedAt === undefined,
    );
  }

  async createAlbum(name: string): Promise<AlbumRecord> {
    const record: AlbumRecord = {
      id: crypto.randomUUID(),
      name: validateAlbumName(name),
      createdAt: Date.now(),
    };
    await this.database.albums.add(record);
    return record;
  }

  async renameAlbum(albumId: string, name: string): Promise<void> {
    await requireAlbum(this.database, albumId);
    await this.database.albums.update(albumId, { name: validateAlbumName(name) });
  }

  deleteAlbum(albumId: string): Promise<void> {
    return this.database.transaction(
      "rw",
      this.database.albums,
      this.database.albumItems,
      async () => {
        await requireAlbum(this.database, albumId);
        await this.database.albums.delete(albumId);
        await this.database.albumItems.where("albumId").equals(albumId).delete();
      },
    );
  }

  async addImagesToAlbum(albumId: string, imageIds: string[]): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.albums,
      this.database.albumItems,
      this.database.images,
      async () => {
        const album = await requireAlbum(this.database, albumId);
        // Wait for the full membership set before writing so new items' sort
        // order continues after the last existing item.
        const existing = await this.database.albumItems
          .where("albumId")
          .equals(albumId)
          .toArray();
        const memberIds = new Set(existing.map((item) => item.imageId));
        let nextOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1);
        for (const imageId of imageIds) {
          if (memberIds.has(imageId)) continue;
          const image = await this.database.images.get(imageId);
          if (!image || image.deletedAt !== undefined) continue;
          nextOrder += 1;
          memberIds.add(imageId);
          await this.database.albumItems.add({ albumId, imageId, sortOrder: nextOrder });
          if (album.coverImageId === undefined) {
            await this.database.albums.update(albumId, { coverImageId: imageId });
          }
        }
      },
    );
  }

  async removeImagesFromAlbum(albumId: string, imageIds: string[]): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.albums,
      this.database.albumItems,
      async () => {
        const album = await requireAlbum(this.database, albumId);
        for (const imageId of imageIds) {
          await this.database.albumItems.delete([albumId, imageId]);
        }
        if (album.coverImageId !== undefined && imageIds.includes(album.coverImageId)) {
          const remaining = await this.database.albumItems
            .where("albumId")
            .equals(albumId)
            .sortBy("sortOrder");
          const nextCover = remaining[0]?.imageId;
          if (nextCover === undefined) {
            await this.database.albums.update(albumId, { coverImageId: undefined });
          } else {
            await this.database.albums.update(albumId, { coverImageId: nextCover });
          }
        }
      },
    );
  }

  async reorderAlbumItem(
    albumId: string,
    imageId: string,
    position: number,
  ): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.albums,
      this.database.albumItems,
      async () => {
        await requireAlbum(this.database, albumId);
        const items = await this.database.albumItems
          .where("albumId")
          .equals(albumId)
          .sortBy("sortOrder");
        const currentIndex = items.findIndex((item) => item.imageId === imageId);
        if (currentIndex < 0) {
          throw new AlbumError("That photo is not in this album.");
        }
        const target = Math.max(0, Math.min(position, items.length - 1));
        if (target === currentIndex) return;
        const moved = items.splice(currentIndex, 1)[0];
        if (moved === undefined) return;
        items.splice(target, 0, moved);
        for (const [order, item] of items.entries()) {
          item.sortOrder = order;
          await this.database.albumItems.put(item);
        }
      },
    );
  }

  async setAlbumCover(albumId: string, imageId: string): Promise<void> {
    await this.database.transaction(
      "rw",
      this.database.albums,
      this.database.albumItems,
      async () => {
        await requireAlbum(this.database, albumId);
        const count = await this.database.albumItems
          .where("[albumId+imageId]")
          .equals([albumId, imageId])
          .count();
        if (count === 0) {
          throw new AlbumError("That photo is not in this album.");
        }
        await this.database.albums.update(albumId, { coverImageId: imageId });
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

async function requireAlbum(
  database: VistaDatabase,
  albumId: string,
): Promise<AlbumRecord> {
  const album = await database.albums.get(albumId);
  if (!album) throw new AlbumError("This album no longer exists.");
  return album;
}

function validateAlbumName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new AlbumError("An album needs a name.");
  }
  return trimmed;
}

async function deleteImageRows(database: VistaDatabase, id: string): Promise<void> {
  await Promise.all([
    database.images.delete(id),
    database.blobs.delete(id),
    database.thumbs.delete(id),
    database.edits.delete(id),
    database.ocr.delete(id),
    database.vectors.delete(id),
    database.albumItems.where("imageId").equals(id).delete(),
  ]);
}

async function repairAlbumCovers(
  database: VistaDatabase,
  deletedIds: Set<string>,
): Promise<void> {
  const albums = await database.albums.toArray();
  for (const album of albums) {
    if (!album.coverImageId || !deletedIds.has(album.coverImageId)) continue;
    const remaining = await database.albumItems
      .where("albumId")
      .equals(album.id)
      .sortBy("sortOrder");
    let nextImage: (typeof remaining)[number] | undefined;
    for (const item of remaining) {
      if (deletedIds.has(item.imageId)) continue;
      const image = await database.images.get(item.imageId);
      if (image && image.deletedAt === undefined) {
        nextImage = item;
        break;
      }
    }
    await database.albums.update(album.id, { coverImageId: nextImage?.imageId });
  }
}

async function removeDeletedAt(database: VistaDatabase, id: string): Promise<void> {
  await database.images
    .where("id")
    .equals(id)
    .modify((image: ImageRecord) => {
      delete image.deletedAt;
    });
}

function storedBlob(blob: Blob | ArrayBuffer, mimeType: string): Blob {
  if (blob instanceof ArrayBuffer) {
    return new Blob([blob], { type: mimeType });
  }
  return blob;
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
