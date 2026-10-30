import { describe, expect, it } from "vitest";
import {
  BACKUP_ORIGINAL_PREFIX,
  BackupManifestError,
  buildManifest,
  formatOriginalPath,
  formatThumbnailPath,
  planBackupImport,
  validateBackupManifest,
} from "@/core/backup/backup-manifest";
import type { ImageRecord } from "@/core/storage/models";

function image(overrides: Partial<ImageRecord>): ImageRecord {
  return {
    id: "img-1",
    name: "Beach.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1200,
    width: 800,
    height: 600,
    importedAt: 100,
    contentHash: "a".repeat(64),
    ...overrides,
  };
}

function manifestWith(images: ImageRecord[]) {
  const manifest = buildManifest({
    images,
    albums: [],
    albumItems: [],
    edits: [],
    ocr: [],
    checksums: {},
  });
  // Round-trip through JSON like a real archive read would.
  return validateBackupManifest(JSON.parse(JSON.stringify(manifest)));
}

describe("backup paths", () => {
  it("derives flat id-based paths", () => {
    const row = image({});
    expect(formatOriginalPath(row)).toBe("files/img-1.jpg");
    expect(formatThumbnailPath(row)).toBe("thumbs/img-1.webp");
  });

  it("falls back to .bin for unknown mime types", () => {
    expect(formatOriginalPath(image({ mimeType: "image/x-weird" }))).toBe(
      `${BACKUP_ORIGINAL_PREFIX}img-1.bin`,
    );
  });
});

describe("validateBackupManifest", () => {
  it("rejects non-VISTA files", () => {
    expect(() => validateBackupManifest({ app: "other" })).toThrow(BackupManifestError);
    expect(() => validateBackupManifest(null)).toThrow(BackupManifestError);
  });

  it("rejects newer schema versions", () => {
    expect(() =>
      validateBackupManifest({
        app: "vista",
        schemaVersion: 99,
        images: [],
        checksums: {},
      }),
    ).toThrow(/newer VISTA version/);
  });

  it("rejects hostile zip paths in the checksum list", () => {
    const manifest = manifestWith([image({})]);
    const hostile = { ...manifest, checksums: { "../outside.jpg": "0".repeat(64) } };
    expect(() => validateBackupManifest(hostile)).toThrow(BackupManifestError);
  });

  it("rejects checksum entries for files that are not described", () => {
    const manifest = manifestWith([image({})]);
    const extra = {
      ...manifest,
      checksums: { "files/ghost.jpg": "0".repeat(64) },
    };
    expect(() => validateBackupManifest(extra)).toThrow(/not described/);
  });

  it("accepts a valid manifest with thumbnails and albums", () => {
    const manifest = manifestWith([image({})]);
    manifest.checksums = {
      "files/img-1.jpg": manifest.images[0].contentHash,
      "thumbs/img-1.webp": "0".repeat(64),
    };
    expect(() => validateBackupManifest(manifest)).not.toThrow();
  });

  it("rejects rows with missing required fields", () => {
    const manifest = manifestWith([image({})]);
    delete (manifest.images[0] as unknown as Record<string, unknown>).contentHash;
    expect(() => validateBackupManifest(manifest)).toThrow(/missing required fields/);
  });
});

describe("planBackupImport", () => {
  const manifest = validateBackupManifest(
    JSON.parse(
      JSON.stringify(
        buildManifest({
          images: [
            image({ id: "new-1", contentHash: "b".repeat(64) }),
            image({ id: "dup-id" }),
            image({ id: "dup-hash", contentHash: "a".repeat(64), name: "Twin.jpg" }),
            image({ id: "no-file", contentHash: "c".repeat(64) }),
          ],
          albums: [{ id: "album-a", name: "Trips", createdAt: 5 }],
          albumItems: [
            { albumId: "album-a", imageId: "new-1", sortOrder: 0 },
            { albumId: "album-a", imageId: "dup-id", sortOrder: 1 },
          ],
          // needed for the a-checksum consistency re-verified by tests
          edits: [],
          ocr: [],
          checksums: {},
        }),
      ),
    ),
  );

  it("skips duplicates and unavailable files, imports the rest", () => {
    const plan = planBackupImport(
      manifest,
      {
        existingImages: new Map([
          ["dup-id", image({ id: "dup-id" })],
          ["local-twin", image({ id: "local-twin" })],
        ]),
        existingAlbumsByName: new Map(),
      },
      new Set(["files/new-1.jpg"]),
    );

    expect(plan.images.map((row) => row.id)).toEqual(["new-1"]);
    expect(plan.skipped).toEqual([
      { id: "dup-id", name: image({ id: "dup-id" }).name, reason: "existing-id" },
      { id: "dup-hash", name: "Twin.jpg", reason: "identical-photo" },
      { id: "no-file", name: "Beach.jpg", reason: "missing-file" },
    ]);
    expect(plan.thumbnails.get("new-1")).toBe("thumbs/new-1.webp");
  });

  it("maps albums onto reused albums by name", () => {
    const plan = planBackupImport(
      manifest,
      {
        existingImages: new Map(),
        existingAlbumsByName: new Map([
          ["trips", { id: "local-album", name: "Trips", createdAt: 1 }],
        ]),
      },
      new Set(["files/new-1.jpg"]),
    );

    expect(plan.albums).toHaveLength(0);
    expect(plan.albumIdMap.get("album-a")).toBe("local-album");
    expect(plan.albumItems).toEqual([
      { albumId: "local-album", imageId: "new-1", sortOrder: 0 },
    ]);
  });

  it("creates albums when no name matches", () => {
    const plan = planBackupImport(
      manifest,
      { existingImages: new Map(), existingAlbumsByName: new Map() },
      new Set(["files/new-1.jpg"]),
    );
    expect(plan.albums.map((album) => album.id)).toEqual(["album-a"]);
    expect(plan.albumItems[0].albumId).toBe("album-a");
  });
});
