import * as Comlink from "comlink";
import { AsyncUnzipInflate, Unzip, UnzipPassThrough, zipSync } from "fflate";
import { getVistaDatabase } from "@/core/storage/database";
import {
  planBackupImport,
  validateBackupManifest,
  buildManifest,
  formatOriginalPath,
  formatThumbnailPath,
  BACKUP_MANIFEST_NAME,
} from "@/core/backup/backup-manifest";
import { MAX_FILE_SIZE_BYTES } from "@/core/limits";

const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 20_000;
const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;

const api = {
  async exportLibrary(): Promise<ArrayBuffer> {
    const db = getVistaDatabase();
    const images = await db.images.toArray();
    const imageIds = new Set(images.map((image) => image.id));
    const [blobs, thumbs, albums, allItems, edits, ocr] = await Promise.all([
      db.blobs.toArray(),
      db.thumbs.toArray(),
      db.albums.toArray(),
      db.albumItems.toArray(),
      db.edits.toArray(),
      db.ocr.toArray(),
    ]);
    const blobMap = new Map(blobs.map((row) => [row.id, row]));
    const thumbMap = new Map(thumbs.map((row) => [row.id, row]));
    const totalBytes = images.reduce((total, image) => {
      const original = blobMap.get(image.id)?.blob;
      const thumbnail = thumbMap.get(image.id)?.blob;
      return total + byteLength(original) + byteLength(thumbnail);
    }, 0);
    if (totalBytes > MAX_EXPANDED_BYTES) {
      throw new Error("This library exceeds VISTA's 512 MB backup limit.");
    }
    const entries: Record<string, Uint8Array> = {};
    const checksums: Record<string, string> = {};
    for (const image of images) {
      const original = blobMap.get(image.id);
      if (!original) throw new Error(`The original for ${image.name} is missing.`);
      const originalPath = formatOriginalPath(image);
      const bytes = await bytesOf(original.blob);
      entries[originalPath] = bytes;
      checksums[originalPath] = await sha256(bytes);
      const thumbnail = thumbMap.get(image.id);
      if (thumbnail) {
        const thumbPath = formatThumbnailPath(image);
        const thumbBytes = await bytesOf(thumbnail.blob);
        entries[thumbPath] = thumbBytes;
        checksums[thumbPath] = await sha256(thumbBytes);
      }
    }
    const manifest = buildManifest({
      images,
      albums,
      albumItems: allItems.filter((item) => imageIds.has(item.imageId)),
      edits: edits.filter((edit) => imageIds.has(edit.imageId)),
      ocr: ocr.filter((row) => imageIds.has(row.imageId)),
      checksums,
    });
    entries[BACKUP_MANIFEST_NAME] = new TextEncoder().encode(JSON.stringify(manifest));
    const archive = zipSync(entries, { level: 1 });
    return archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength,
    );
  },

  async importLibrary(buffer: ArrayBuffer): Promise<{ imported: number; skipped: number }> {
    if (buffer.byteLength > MAX_ARCHIVE_BYTES)
      throw new Error("This backup is larger than the supported 512 MB limit.");
    const entries = await unzipLimited(new Uint8Array(buffer));
    const manifestBytes = entries[BACKUP_MANIFEST_NAME];
    if (!manifestBytes || manifestBytes.byteLength > MAX_MANIFEST_BYTES)
      throw new Error("The backup manifest is missing or too large.");
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
    } catch {
      throw new Error("The backup manifest is not valid JSON.");
    }
    const manifest = validateBackupManifest(raw);
    const available = new Set<string>();
    for (const [path, bytes] of Object.entries(entries)) {
      if (path === BACKUP_MANIFEST_NAME) continue;
      if (bytes.byteLength > MAX_FILE_SIZE_BYTES)
        throw new Error("A backup file exceeds the 50 MB image limit.");
      const expected = manifest.checksums[path];
      if (!expected || (await sha256(bytes)) !== expected)
        throw new Error(`A backup file failed its checksum: ${path}`);
      available.add(path);
    }
    for (const image of manifest.images) {
      const path = formatOriginalPath(image);
      const bytes = entries[path];
      if (bytes && (await sha256(bytes)) !== image.contentHash)
        throw new Error(`The photo hash does not match the manifest: ${path}`);
    }
    for (const path of Object.keys(manifest.checksums))
      if (!available.has(path)) throw new Error(`A backup file is missing: ${path}`);
    const db = getVistaDatabase();
    const [localImages, localAlbums] = await Promise.all([
      db.images.toArray(),
      db.albums.toArray(),
    ]);
    const plan = planBackupImport(
      manifest,
      {
        existingImages: new Map(localImages.map((image) => [image.id, image])),
        existingAlbumsByName: new Map(
          localAlbums.map((album) => [album.name.trim().toLowerCase(), album]),
        ),
        existingAlbumIds: new Set(localAlbums.map((album) => album.id)),
      },
      available,
    );
    await db.transaction(
      "rw",
      [db.images, db.blobs, db.thumbs, db.albums, db.albumItems, db.edits, db.ocr],
      async () => {
        for (const image of plan.images) {
          const originalPath = formatOriginalPath(image);
          const original = entries[originalPath];
          if (!original) continue;
          const thumbPath = formatThumbnailPath(image);
          const thumbnail = entries[thumbPath];
          await db.images.add(image);
          await db.blobs.add({
            id: image.id,
            blob: original.slice().buffer as ArrayBuffer,
            mimeType: image.mimeType,
          });
          if (thumbnail)
            await db.thumbs.add({
              id: image.id,
              blob: thumbnail.slice().buffer as ArrayBuffer,
              mimeType: "image/webp",
            });
        }
        await db.albums.bulkAdd(plan.albums);
        await db.albumItems.bulkAdd(plan.albumItems);
        await db.edits.bulkAdd(plan.edits);
        await db.ocr.bulkAdd(plan.ocr);
      },
    );
    return { imported: plan.images.length, skipped: plan.skipped.length };
  },
};

async function bytesOf(value: Blob | ArrayBuffer): Promise<Uint8Array> {
  return value instanceof Blob
    ? new Uint8Array(await value.arrayBuffer())
    : new Uint8Array(value);
}

function byteLength(value: Blob | ArrayBuffer | undefined): number {
  if (!value) return 0;
  return value instanceof Blob ? value.size : value.byteLength;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function unzipLimited(input: Uint8Array): Promise<Record<string, Uint8Array>> {
  return await new Promise((resolve, reject) => {
    const entries: Record<string, Uint8Array> = {};
    const pending: Promise<void>[] = [];
    let totalBytes = 0;
    let count = 0;
    try {
      const unzipper = new Unzip((file) => {
        count += 1;
        if (count > MAX_ARCHIVE_ENTRIES)
          throw new Error("This backup contains too many files.");
        if (
          file.name !== BACKUP_MANIFEST_NAME &&
          !file.name.startsWith("files/") &&
          !file.name.startsWith("thumbs/")
        )
          throw new Error("The backup contains an unexpected file path.");
        if (
          file.name
            .split("/")
            .some((part) => !part || part === "." || part === ".." || part.includes("\\"))
        )
          throw new Error("The backup contains an unsafe file path.");
        const maxBytes =
          file.name === BACKUP_MANIFEST_NAME ? MAX_MANIFEST_BYTES : MAX_FILE_SIZE_BYTES;
        if (file.originalSize !== undefined && file.originalSize > maxBytes)
          throw new Error("A backup entry exceeds its allowed size.");
        const chunks: Uint8Array[] = [];
        let fileBytes = 0;
        const complete = new Promise<void>((fileResolve, fileReject) => {
          file.ondata = (error, chunk, final) => {
            if (error) {
              fileReject(error);
              return;
            }
            fileBytes += chunk.byteLength;
            totalBytes += chunk.byteLength;
            if (fileBytes > maxBytes || totalBytes > MAX_EXPANDED_BYTES) {
              fileReject(new Error("The backup expands beyond the allowed size."));
              return;
            }
            chunks.push(chunk);
            if (final) {
              const bytes = new Uint8Array(fileBytes);
              let offset = 0;
              for (const part of chunks) {
                bytes.set(part, offset);
                offset += part.byteLength;
              }
              entries[file.name] = bytes;
              fileResolve();
            }
          };
        });
        pending.push(complete);
        file.start();
      });
      unzipper.register(UnzipPassThrough);
      unzipper.register(AsyncUnzipInflate);
      unzipper.push(input, true);
      void Promise.all(pending).then(() => resolve(entries), reject);
    } catch (error) {
      reject(
        error instanceof Error ? error : new Error("This backup archive is malformed."),
      );
    }
  });
}

Comlink.expose(api);
