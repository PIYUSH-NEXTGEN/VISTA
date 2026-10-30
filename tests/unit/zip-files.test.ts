import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { zipFiles } from "@/core/export/zip-files";

describe("streaming ZIP export", () => {
  it("streams blob content into a valid archive without changing filenames", async () => {
    const input = new Uint8Array(1024 * 1024 + 17);
    input.set(new TextEncoder().encode("first bytes"));
    input.set(new TextEncoder().encode("last bytes"), input.length - 10);
    const archive = await zipFiles([
      { name: "large photo.png", blob: new Blob([input]) },
      { name: "empty.txt", blob: new Blob() },
    ]);
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    const photo = entries["large photo.png"];
    expect(photo).toBeDefined();
    expect(photo?.byteLength).toBe(input.byteLength);
    expect(strFromU8(photo?.subarray(0, 11) ?? new Uint8Array())).toBe("first bytes");
    expect(strFromU8(photo?.subarray(-10) ?? new Uint8Array())).toBe("last bytes");
    expect(entries["empty.txt"]?.byteLength).toBe(0);
  });

  it("rejects duplicate sanitized names", async () => {
    await expect(
      zipFiles([
        { name: "photo.jpg", blob: new Blob(["a"]) },
        { name: "photo.jpg", blob: new Blob(["b"]) },
      ]),
    ).rejects.toThrow("Duplicate export filename");
  });
});
