/**
 * Integration seed test: verifies fake-indexeddb provides a working
 * IndexedDB implementation so Phase 1 storage tests can rely on it.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

describe("fake-indexeddb", () => {
  it("supports open, put, and get round-trips", async () => {
    const req = indexedDB.open("vista-phase0-test", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      // IDBObjectStore.put takes (value, key) for out-of-line keys.
      tx.objectStore("kv").put("hello", "vista");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const value = await new Promise<string>((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const get = tx.objectStore("kv").get("vista");
      get.onsuccess = () => resolve(get.result as string);
      get.onerror = () => reject(get.error);
    });

    expect(value).toBe("hello");
    db.close();
  });
});
