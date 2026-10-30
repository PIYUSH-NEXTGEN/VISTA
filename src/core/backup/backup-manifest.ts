import type {
  AlbumItemRecord,
  AlbumRecord,
  EditRecord,
  ImageRecord,
  OcrRecord,
} from "@/core/storage/models";

/* Backup container layout (agent.md 6.4):
 *
 *   manifest.json        <- BackupManifest (all metadata)
 *   files/<id>.<ext>     <- original image bytes
 *   thumbs/<id>.webp     <- stored thumbnail bytes
 *
 * Files are addressed by image id + extension derived from the MIME type, so
 * user-controlled names never end up in zip paths. The manifest references
 * every entry with a SHA-256 checksum (the image's contentHash) so imports
 * can verify the bytes before storing them. */

export const BACKUP_APP_TAG = "vista";
export const BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_MANIFEST_NAME = "manifest.json";
export const BACKUP_ORIGINAL_PREFIX = "files/";
export const BACKUP_THUMB_PREFIX = "thumbs/";

export interface BackupEditRow {
  imageId: string;
  steps: unknown[];
}

export interface BackupManifest {
  app: typeof BACKUP_APP_TAG;
  createdAt: string;
  schemaVersion: number;
  images: ImageRecord[];
  albums: AlbumRecord[];
  albumItems: AlbumItemRecord[];
  edits: BackupEditRow[];
  ocr: OcrRecord[];
  /** Zip entry path -> sha-256 hex digest of the entry's bytes. */
  checksums: Record<string, string>;
}

export class BackupManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupManifestError";
  }
}

const KNOWN_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMimeType(mimeType: string): string {
  return KNOWN_EXTENSIONS[mimeType.toLowerCase()] ?? "bin";
}

export function formatOriginalPath(image: ImageRecord): string {
  return `${BACKUP_ORIGINAL_PREFIX}${image.id}.${extensionForMimeType(image.mimeType)}`;
}

export function formatThumbnailPath(image: ImageRecord): string {
  return `${BACKUP_THUMB_PREFIX}${image.id}.webp`;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateImageRow(value: unknown): ImageRecord {
  if (typeof value !== "object" || value === null) {
    throw new BackupManifestError("A backup image entry is malformed.");
  }
  const row = value as Record<string, unknown>;
  if (
    !isString(row.id) ||
    !isString(row.name) ||
    !isString(row.mimeType) ||
    !isNumber(row.sizeBytes) ||
    !isNumber(row.width) ||
    !isNumber(row.height) ||
    !isNumber(row.importedAt) ||
    !isString(row.contentHash)
  ) {
    throw new BackupManifestError(
      `The backup entry "${String(row.name ?? "unknown")}" is missing required fields.`,
    );
  }
  const optional: { takenAt?: unknown; orientation?: unknown; deletedAt?: unknown } = row;
  const image: ImageRecord = {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    importedAt: row.importedAt,
    contentHash: row.contentHash,
  };
  if (isNumber(optional.takenAt)) image.takenAt = optional.takenAt;
  if (isNumber(optional.orientation)) image.orientation = optional.orientation;
  if (isString(row.camera)) image.camera = row.camera;
  if (isNumber(optional.deletedAt)) image.deletedAt = optional.deletedAt;
  return image;
}

function validateAlbumRow(value: unknown): AlbumRecord {
  if (typeof value !== "object" || value === null) {
    throw new BackupManifestError("A backup album entry is malformed.");
  }
  const row = value as Record<string, unknown>;
  if (!isString(row.id) || !isString(row.name) || !isNumber(row.createdAt)) {
    throw new BackupManifestError("A backup album entry is missing required fields.");
  }
  const album: AlbumRecord = {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
  };
  if (isString(row.coverImageId)) album.coverImageId = row.coverImageId;
  return album;
}

function validateItemRow(value: unknown): AlbumItemRecord {
  if (typeof value !== "object" || value === null) {
    throw new BackupManifestError("A backup album item is malformed.");
  }
  const row = value as Record<string, unknown>;
  if (!isString(row.albumId) || !isString(row.imageId) || !isNumber(row.sortOrder)) {
    throw new BackupManifestError("A backup album item is missing required fields.");
  }
  return { albumId: row.albumId, imageId: row.imageId, sortOrder: row.sortOrder };
}

function validateEditRow(value: unknown): BackupEditRow {
  if (typeof value !== "object" || value === null) {
    throw new BackupManifestError("A backup edit entry is malformed.");
  }
  const row = value as Record<string, unknown>;
  if (!isString(row.imageId) || !Array.isArray(row.steps)) {
    throw new BackupManifestError("A backup edit entry is missing required fields.");
  }
  return { imageId: row.imageId, steps: row.steps };
}

function validateOcrRow(value: unknown): OcrRecord {
  if (typeof value !== "object" || value === null) {
    throw new BackupManifestError("A backup OCR entry is malformed.");
  }
  const row = value as Record<string, unknown>;
  if (!isString(row.imageId) || !isString(row.text) || !isString(row.language)) {
    throw new BackupManifestError("A backup OCR entry is missing required fields.");
  }
  const record: OcrRecord = {
    imageId: row.imageId,
    text: row.text,
    language: row.language,
  };
  if (isNumber(row.confidence)) record.confidence = row.confidence;
  return record;
}

function validateChecksumEntries(checksums: unknown): Record<string, string> {
  if (typeof checksums !== "object" || checksums === null) {
    throw new BackupManifestError("The backup checksum list is malformed.");
  }
  const entries = checksums as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [path, digest] of Object.entries(entries)) {
    if (!isChecksumDigest(digest)) {
      throw new BackupManifestError(`The checksum for "${path}" is not valid.`);
    }
    assertSafeBackupPath(path);
    result[path] = digest;
  }
  return result;
}

function isChecksumDigest(value: unknown): value is string {
  return isString(value) && /^[0-9a-f]{64}$/.test(value);
}

/* Zip entries are read with their paths, and a hostile archive must never be
 * able to escape the backup's own folders. Reject anything other than the
 * flat files/ or thumbs/ layout (also blocks "../", "..\\", and absolute paths). */
function assertSafeBackupPath(path: string): void {
  const allowed =
    path.startsWith(BACKUP_ORIGINAL_PREFIX) || path.startsWith(BACKUP_THUMB_PREFIX);
  const safeSegments = path
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("\\") &&
        segment !== "",
    );
  if (!allowed || !safeSegments || path.includes("//")) {
    throw new BackupManifestError(`The backup contains an unexpected path: "${path}".`);
  }
}

export function validateBackupManifest(raw: unknown): BackupManifest {
  if (typeof raw !== "object" || raw === null) {
    throw new BackupManifestError("This file is not a VISTA backup.");
  }
  const root = raw as Record<string, unknown>;
  if (root.app !== BACKUP_APP_TAG) {
    throw new BackupManifestError("This file is not a VISTA backup.");
  }
  if (!isNumber(root.schemaVersion) || root.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupManifestError(
      `This backup was made by a newer VISTA version (schema ${String(root.schemaVersion)}). Update VISTA first.`,
    );
  }
  if (!Array.isArray(root.images)) {
    throw new BackupManifestError("The backup image list is malformed.");
  }
  const manifest: BackupManifest = {
    app: BACKUP_APP_TAG,
    createdAt: isString(root.createdAt) ? root.createdAt : new Date(0).toISOString(),
    schemaVersion: root.schemaVersion,
    images: root.images.map(validateImageRow),
    albums: Array.isArray(root.albums) ? root.albums.map(validateAlbumRow) : [],
    albumItems: Array.isArray(root.albumItems) ? root.albumItems.map(validateItemRow) : [],
    edits: Array.isArray(root.edits) ? root.edits.map(validateEditRow) : [],
    ocr: Array.isArray(root.ocr) ? root.ocr.map(validateOcrRow) : [],
    checksums: validateChecksumEntries(root.checksums ?? {}),
  };

  const paths = new Set([
    ...manifest.images.map(formatOriginalPath),
    ...manifest.images.map(formatThumbnailPath),
  ]);
  for (const path of Object.keys(manifest.checksums)) {
    if (!paths.has(path)) {
      throw new BackupManifestError(
        `The backup has a checksum for a file that is not described: "${path}".`,
      );
    }
  }
  return manifest;
}

export type BackupSkipReason = "existing-id" | "identical-photo" | "missing-file";

export interface BackupImportPlan {
  images: ImageRecord[];
  /** imageId -> thumbnail path found in the manifest. */
  thumbnails: Map<string, string>;
  albums: AlbumRecord[];
  /** Source album id from the manifest -> target album id in this library. */
  albumIdMap: Map<string, string>;
  albumItems: AlbumItemRecord[];
  edits: BackupEditRow[];
  ocr: OcrRecord[];
  skipped: { id: string; name: string; reason: BackupSkipReason }[];
}

export interface BackupImportOptions {
  /** Rows already in this library (live or trashed) keyed by id. */
  existingImages: Map<string, ImageRecord>;
  /** Albums already in this library keyed by lowercase name. */
  existingAlbumsByName: Map<string, AlbumRecord>;
}

/* Conflict policy: never overwrite silently (agent.md 6.4).
 * - same id -> skip
 * - same content hash -> keep the local copy, skip the archive copy
 * - albums are matched by name and reused, otherwise created */
export function planBackupImport(
  manifest: BackupManifest,
  options: BackupImportOptions,
  /** Paths of data entries actually present in the archive and passing checksum. */
  availableFilePaths: Set<string>,
): BackupImportPlan {
  const plan: BackupImportPlan = {
    images: [],
    thumbnails: new Map(),
    albums: [],
    albumIdMap: new Map(),
    albumItems: [],
    edits: [],
    ocr: [],
    skipped: [],
  };

  const importedIds = new Set<string>();
  const hashesInLibrary = new Map<string, string>();
  for (const local of options.existingImages.values()) {
    hashesInLibrary.set(local.contentHash, local.id);
  }
  for (const image of manifest.images) {
    const local = options.existingImages.get(image.id);
    if (local !== undefined) {
      plan.skipped.push({ id: image.id, name: image.name, reason: "existing-id" });
      continue;
    }
    if (hashesInLibrary.has(image.contentHash)) {
      plan.skipped.push({ id: image.id, name: image.name, reason: "identical-photo" });
      continue;
    }
    if (!availableFilePaths.has(formatOriginalPath(image))) {
      plan.skipped.push({ id: image.id, name: image.name, reason: "missing-file" });
      continue;
    }
    plan.images.push(image);
    importedIds.add(image.id);
    plan.thumbnails.set(image.id, `${BACKUP_THUMB_PREFIX}${image.id}.webp`);
  }

  for (const album of manifest.albums) {
    const reused = options.existingAlbumsByName.get(album.name.trim().toLowerCase());
    if (reused !== undefined) {
      plan.albumIdMap.set(album.id, reused.id);
      continue;
    }
    plan.albumIdMap.set(album.id, album.id);
    plan.albums.push(album);
  }

  for (const item of manifest.albumItems) {
    if (!importedIds.has(item.imageId)) continue;
    const targetAlbumId = plan.albumIdMap.get(item.albumId);
    if (targetAlbumId === undefined) continue;
    plan.albumItems.push({ ...item, albumId: targetAlbumId });
  }

  plan.edits = manifest.edits.filter((row) => importedIds.has(row.imageId));
  plan.ocr = manifest.ocr.filter((row) => importedIds.has(row.imageId));
  return plan;
}

export function buildManifest(payload: {
  images: ImageRecord[];
  albums: AlbumRecord[];
  albumItems: AlbumItemRecord[];
  edits: EditRecord[];
  ocr: OcrRecord[];
  checksums: Record<string, string>;
}): BackupManifest {
  return {
    app: BACKUP_APP_TAG,
    createdAt: new Date().toISOString(),
    schemaVersion: BACKUP_SCHEMA_VERSION,
    images: payload.images,
    albums: payload.albums,
    albumItems: payload.albumItems,
    edits: payload.edits.map((row) => ({
      imageId: row.imageId,
      steps: Array.isArray(row.steps) ? row.steps : [],
    })),
    ocr: payload.ocr,
    checksums: payload.checksums,
  };
}
