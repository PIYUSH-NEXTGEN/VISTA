import { describe, expect, it } from "vitest";
import { ImageInspectionError, inspectImage } from "@/core/image-import/inspect-image";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
  ]);
}

function webpVp8xHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([...new TextEncoder().encode("RIFF")], 0);
  bytes.set([...new TextEncoder().encode("WEBP")], 8);
  bytes.set([...new TextEncoder().encode("VP8X")], 12);
  writeUint24LE(bytes, 24, width - 1);
  writeUint24LE(bytes, 27, height - 1);
  return bytes;
}

function writeUint24LE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

describe("inspectImage", () => {
  it("uses PNG header dimensions and ignores the declared MIME type", async () => {
    const file = new File([pngHeader(640, 480)], "photo.jpg", {
      type: "image/jpeg",
    });

    await expect(inspectImage(file)).resolves.toEqual({
      format: "png",
      mimeType: "image/png",
      width: 640,
      height: 480,
    });
  });

  it("reads JPEG dimensions from a frame header", async () => {
    const header = await inspectImage(new Blob([jpegHeader(1200, 800)]));
    expect(header).toMatchObject({ format: "jpeg", width: 1200, height: 800 });
  });

  it("reads WebP extended dimensions", async () => {
    const header = await inspectImage(new Blob([webpVp8xHeader(320, 240)]));
    expect(header).toMatchObject({ format: "webp", width: 320, height: 240 });
  });

  it("rejects unsupported HEIC before attempting to decode it", async () => {
    const bytes = new Uint8Array(16);
    bytes.set(new TextEncoder().encode("ftypheic"), 4);
    await expect(inspectImage(new Blob([bytes]))).rejects.toMatchObject({
      code: "unsupportedFormat",
      message:
        "HEIC/HEIF files are not supported. Choose a JPEG, PNG, or WebP image instead.",
    });
  });

  it("rejects mislabeled non-image files", async () => {
    const file = new File(["not an image"], "photo.png", { type: "image/png" });
    await expect(inspectImage(file)).rejects.toMatchObject({
      code: "invalidMagic",
    });
  });

  it("rejects empty files as a malformed header", async () => {
    await expect(inspectImage(new Blob([]))).rejects.toMatchObject({
      code: "malformedHeader",
    });
  });

  it.each([
    ["corrupt input", new TextEncoder().encode("broken image bytes")],
    [
      "active SVG input",
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    ],
  ])("rejects %s by its file content", async (_description, bytes) => {
    await expect(inspectImage(new Blob([bytes]))).rejects.toMatchObject({
      code: "invalidMagic",
    });
  });

  it("rejects decompression bombs based on header dimensions", async () => {
    await expect(inspectImage(new Blob([pngHeader(10_001, 10_000)]))).rejects.toMatchObject(
      {
        code: "tooManyPixels",
      },
    );
  });

  it("rejects broken image dimensions", async () => {
    await expect(inspectImage(new Blob([pngHeader(0, 480)]))).rejects.toBeInstanceOf(
      ImageInspectionError,
    );
  });
});
