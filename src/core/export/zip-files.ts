import { Zip, ZipDeflate } from "fflate";

const MAX_ZIP_BYTES = 512 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;

export async function zipFiles(rows: { name: string; blob: Blob }[]): Promise<Blob> {
  const total = rows.reduce((sum, row) => sum + row.blob.size, 0);
  if (total > MAX_ZIP_BYTES)
    throw new Error("Multi-file ZIP exports are limited to 512 MB.");
  if (rows.length > 10_000)
    throw new Error("A ZIP export can contain at most 10,000 files.");

  const names = new Set<string>();
  const parts: ArrayBuffer[] = [];
  let outputBytes = 0;
  let streamError: Error | undefined;
  const zip = new Zip((error, chunk) => {
    if (error) {
      streamError = error;
      return;
    }
    if (!chunk) return;
    outputBytes += chunk.byteLength;
    if (outputBytes > MAX_ZIP_BYTES) {
      streamError = new Error("The compressed export exceeds the 512 MB limit.");
      return;
    }
    const part = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(part).set(chunk);
    parts.push(part);
  });

  for (const row of rows) {
    const name = sanitizeEntryName(row.name);
    if (names.has(name)) throw new Error(`Duplicate export filename: ${name}`);
    names.add(name);
    const entry = new ZipDeflate(name, { level: 1 });
    zip.add(entry);
    for (let offset = 0; offset < row.blob.size; offset += CHUNK_BYTES) {
      const chunk = await row.blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      entry.push(new Uint8Array(chunk), offset + CHUNK_BYTES >= row.blob.size);
    }
    if (row.blob.size === 0) entry.push(new Uint8Array(), true);
  }
  zip.end();
  if (streamError) throw streamError;
  return new Blob(parts, { type: "application/zip" });
}

function sanitizeEntryName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join("")
    .replace(/^\.+/, "")
    .trim();
  if (!safe || safe === "." || safe === "..")
    throw new Error("A file has an invalid export name.");
  return safe.slice(0, 150);
}
