// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { VistaDatabase } from "@/core/storage/database";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";

const databases: VistaDatabase[] = [];

function openTestDatabase(): VistaDatabase {
  const db = new VistaDatabase(`vista-storage-test-${databases.length}`);
  databases.push(db);
  return db;
}

function imageRecord(id: string): ImageRecord {
  return {
    id,
    name: `${id}.png`,
    mimeType: "image/png",
    sizeBytes: 10,
    width: 2,
    height: 2,
    importedAt: 1,
    contentHash: `hash-${id}`,
  };
}

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      database.close();
      await database.delete();
    }),
  );
});

describe("Dexie library storage", () => {
  it("creates the version 1 schema and persists it across reopen", async () => {
    const database = openTestDatabase();
    await database.open();

    expect(database.verno).toBe(1);
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      "albumItems",
      "albums",
      "blobs",
      "edits",
      "images",
      "ocr",
      "settings",
      "thumbs",
      "vectors",
    ]);

    await database.images.add(imageRecord("migrated"));
    database.close();
    await database.open();

    await expect(database.images.get("migrated")).resolves.toMatchObject({
      name: "migrated.png",
    });
  });

  it("saves metadata, original and thumbnail atomically", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    const original = new Blob(["original"], { type: "image/png" });
    const thumbnail = new Blob(["thumbnail"], { type: "image/png" });

    await store.addImage(imageRecord("one"), original, thumbnail);

    await expect(store.getImage("one")).resolves.toMatchObject({
      contentHash: "hash-one",
    });
    const storedOriginal = await store.getOriginal("one");
    const storedThumbnail = await store.getThumbnail("one");
    expect(storedOriginal).toBeInstanceOf(Blob);
    expect(storedThumbnail).toBeInstanceOf(Blob);
    await expect(storedOriginal?.text()).resolves.toBe("original");
    await expect(storedThumbnail?.text()).resolves.toBe("thumbnail");
  });

  it("recreates original Blobs from the ArrayBuffer compatibility representation", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    const bytes = new ArrayBuffer(4);
    new Uint8Array(bytes).set([116, 101, 115, 116]);
    await database.blobs.add({
      id: "buffer-backed",
      blob: bytes,
      mimeType: "image/png",
    });

    const original = await store.getOriginal("buffer-backed");
    expect(original).toBeInstanceOf(Blob);
    await expect(original?.text()).resolves.toBe("test");
    expect(original?.type).toBe("image/png");
  });

  it("recreates thumbnails from the ArrayBuffer compatibility representation", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    const bytes = new ArrayBuffer(4);
    new Uint8Array(bytes).set([116, 101, 115, 116]);
    await database.thumbs.add({
      id: "buffer-backed",
      blob: bytes,
      mimeType: "image/webp",
    });

    const thumbnail = await store.getThumbnail("buffer-backed");
    expect(thumbnail).toBeInstanceOf(Blob);
    await expect(thumbnail?.text()).resolves.toBe("test");
    expect(thumbnail?.type).toBe("image/webp");
  });

  it("rolls back all rows if an image id already exists", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    const record = imageRecord("duplicate");
    await store.addImage(record, new Blob(["first"]), new Blob(["first thumb"]));

    await expect(
      store.addImage(record, new Blob(["second"]), new Blob(["second thumb"])),
    ).rejects.toThrow();
    await expect((await store.getOriginal("duplicate"))?.text()).resolves.toBe("first");
    await expect((await store.getThumbnail("duplicate"))?.text()).resolves.toBe(
      "first thumb",
    );
  });

  it("removes dependent image data in the same transaction", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    await store.addImage(
      imageRecord("remove"),
      new Blob(["original"]),
      new Blob(["thumb"]),
    );
    await database.albums.add({
      id: "album",
      name: "Trip",
      createdAt: 1,
    });
    await database.albumItems.add({
      albumId: "album",
      imageId: "remove",
      sortOrder: 0,
    });
    await database.edits.add({ imageId: "remove", steps: [] });
    await database.ocr.add({ imageId: "remove", text: "receipt", language: "eng" });
    await database.vectors.add({ imageId: "remove", embedding: [0.1] });

    await store.deleteImage("remove");

    await expect(store.getImage("remove")).resolves.toBeUndefined();
    await expect(database.albumItems.count()).resolves.toBe(0);
    await expect(database.edits.count()).resolves.toBe(0);
    await expect(database.ocr.count()).resolves.toBe(0);
    await expect(database.vectors.count()).resolves.toBe(0);
  });
});
