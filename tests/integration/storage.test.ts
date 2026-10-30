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
  it("creates the version 2 schema and persists it across reopen", async () => {
    const database = openTestDatabase();
    await database.open();

    expect(database.verno).toBe(2);
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

  it("creates, renames, and deletes albums without deleting library images", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    await store.addImage(imageRecord("kept"), new Blob(["original"]), new Blob(["thumb"]));

    const album = await store.createAlbum("  Summer trip  ");
    expect(album.name).toBe("Summer trip");
    await store.renameAlbum(album.id, "Weekend away");
    await store.addImagesToAlbum(album.id, ["kept"]);

    await expect(store.listAlbums()).resolves.toMatchObject([
      { album: { id: album.id, name: "Weekend away" }, imageCount: 1 },
    ]);

    await store.deleteAlbum(album.id);
    await expect(store.listAlbums()).resolves.toEqual([]);
    await expect(store.getImage("kept")).resolves.toMatchObject({
      id: "kept",
    });
    await expect(database.blobs.get("kept")).resolves.toBeDefined();
  });

  it("adds, removes, orders, and changes the cover for album photos", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    for (const id of ["first", "second", "third"]) {
      await store.addImage(imageRecord(id), new Blob([id]), new Blob([`${id}-thumb`]));
    }

    const album = await store.createAlbum("Trip");
    await store.addImagesToAlbum(album.id, ["first", "second", "third"]);
    await store.reorderAlbumItem(album.id, "third", 0);
    await store.setAlbumCover(album.id, "second");

    await expect(store.listAlbumImages(album.id)).resolves.toEqual([
      expect.objectContaining({ id: "third" }),
      expect.objectContaining({ id: "first" }),
      expect.objectContaining({ id: "second" }),
    ]);
    await expect(database.albums.get(album.id)).resolves.toMatchObject({
      coverImageId: "second",
    });

    await store.removeImagesFromAlbum(album.id, ["second"]);
    await expect(store.listAlbumImages(album.id)).resolves.toEqual([
      expect.objectContaining({ id: "third" }),
      expect.objectContaining({ id: "first" }),
    ]);
    await expect(database.albums.get(album.id)).resolves.toMatchObject({
      coverImageId: "third",
    });
    await expect(store.getImage("second")).resolves.toMatchObject({ id: "second" });
  });

  it("rejects blank album names and invalid cover photos", async () => {
    const database = openTestDatabase();
    const store = new DexieLibraryStore(database);
    const album = await store.createAlbum("Trip");

    await expect(store.createAlbum(" \t ")).rejects.toThrow("An album needs a name.");
    await expect(store.renameAlbum(album.id, "  ")).rejects.toThrow(
      "An album needs a name.",
    );
    await expect(store.setAlbumCover(album.id, "not-a-member")).rejects.toThrow(
      "That photo is not in this album.",
    );
  });
});
