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
    this.version(1).stores({
      images:
        "&id, name, mimeType, sizeBytes, width, height, importedAt, takenAt, contentHash",
      blobs: "&id",
      thumbs: "&id",
      albums: "&id, name, createdAt",
      albumItems: "&[albumId+imageId], albumId, imageId, sortOrder",
      edits: "&imageId",
      ocr: "&imageId",
      vectors: "&imageId",
      settings: "&key",
    });
  }
}

let database: VistaDatabase | undefined;

export function getVistaDatabase(): VistaDatabase {
  database ??= new VistaDatabase();
  return database;
}
