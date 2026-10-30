import Dexie, { type Table } from "dexie";
import type {
  AlbumItemRecord,
  AlbumRecord,
  EditRecord,
  ImageBlobRecord,
  ImageRecord,
  OcrRecord,
  SettingRecord,
  ThumbnailRecord,
  VectorRecord,
} from "@/core/storage/models";

const SCHEMA_V1_STORES: Record<string, string> = {
  images: "&id, name, mimeType, sizeBytes, width, height, importedAt, takenAt, contentHash",
  blobs: "&id",
  thumbs: "&id",
  albums: "&id, name, createdAt",
  albumItems: "&[albumId+imageId], albumId, imageId, sortOrder",
  edits: "&imageId",
  ocr: "&imageId",
  vectors: "&imageId",
  settings: "&key",
};

const SCHEMA_V2_IMAGES =
  "&id, name, mimeType, sizeBytes, width, height, importedAt, takenAt, contentHash, deletedAt";
const SCHEMA_V3_IMAGES = `${SCHEMA_V2_IMAGES}, perceptualHash`;

export class VistaDatabase extends Dexie {
  images!: Table<ImageRecord, string>;
  blobs!: Table<ImageBlobRecord, string>;
  thumbs!: Table<ThumbnailRecord, string>;
  albums!: Table<AlbumRecord, string>;
  albumItems!: Table<AlbumItemRecord, [string, string]>;
  edits!: Table<EditRecord, string>;
  ocr!: Table<OcrRecord, string>;
  vectors!: Table<VectorRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor(name = "vista") {
    super(name);
    // v1 shipped with the Phase 1 import pipeline. Never modify it; extend
    // schema changes in a new version with an upgrade hook (agent.md 6.2).
    this.version(1).stores(SCHEMA_V1_STORES);
    // v2 adds the trash flow: a deletedAt index on images. Old rows stay valid
    // because ImageRecord.deletedAt is optional; the upgrade only normalises
    // rows that somehow carry a null deletedAt.
    this.version(2)
      .stores({ ...SCHEMA_V1_STORES, images: SCHEMA_V2_IMAGES })
      .upgrade((transaction) =>
        transaction
          .table("images")
          .toCollection()
          .modify((image: ImageRecord) => {
            if (image.deletedAt === null) {
              delete image.deletedAt;
              return image;
            }
            return image;
          }),
      );
    // v3 adds cached perceptual hashes for near-duplicate buckets. Existing
    // records are analyzed on demand in Phase 5; the upgrade does not decode
    // images or block the IndexedDB migration.
    this.version(3).stores({ ...SCHEMA_V1_STORES, images: SCHEMA_V3_IMAGES });
  }
}

let database: VistaDatabase | undefined;

export function getVistaDatabase(): VistaDatabase {
  database ??= new VistaDatabase();
  return database;
}
