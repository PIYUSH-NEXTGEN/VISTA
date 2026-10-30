import { describe, expect, it } from "vitest";
import {
  filterByFormat,
  searchImages,
  sortImages,
  type SortDirection,
  type SortKey,
} from "@/core/storage/library-query";
import type { ImageRecord } from "@/core/storage/models";

function image(overrides: Partial<ImageRecord>): ImageRecord {
  return {
    id: "id",
    name: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1000,
    width: 100,
    height: 100,
    importedAt: 50,
    contentHash: "hash",
    ...overrides,
  };
}

const SAMPLE: ImageRecord[] = [
  image({
    id: "a",
    name: "Beach Sunrise.jpg",
    importedAt: 30,
    takenAt: 200,
    sizeBytes: 800,
    width: 200,
    height: 100,
  }),
  image({
    id: "b",
    name: "Dog on beach.png",
    mimeType: "image/png",
    importedAt: 10,
    takenAt: 300,
    sizeBytes: 500,
    width: 100,
    height: 400,
  }),
  image({
    id: "c",
    name: "receipt-scan.jpg",
    importedAt: 20,
    camera: "Fujifilm X100V",
    sizeBytes: 200,
    width: 400,
    height: 400,
  }),
  image({
    id: "d",
    name: "logo.webp",
    mimeType: "image/webp",
    importedAt: 40,
    sizeBytes: 100,
    width: 10,
    height: 10,
  }),
];

describe("sortImages", () => {
  const cases: [SortKey, SortDirection, string[]][] = [
    ["importedAt", "asc", ["b", "c", "a", "d"]],
    ["importedAt", "desc", ["d", "a", "c", "b"]],
    ["takenAt", "asc", ["d", "c", "a", "b"]],
    ["takenAt", "desc", ["b", "a", "d", "c"]],
    ["sizeBytes", "asc", ["d", "c", "b", "a"]],
    ["sizeBytes", "desc", ["a", "b", "c", "d"]],
    ["dimensions", "desc", ["c", "b", "a", "d"]],
    ["name", "asc", ["a", "b", "d", "c"]],
    ["mimeType", "asc", ["a", "c", "b", "d"]],
  ];

  for (const [key, direction, expected] of cases) {
    it(`sorts by ${key} ${direction}`, () => {
      const sorted = sortImages(SAMPLE, key, direction);
      expect(sorted.map((image) => image.id)).toEqual(expected);
    });
  }

  it("does not mutate the input array", () => {
    const input = [...SAMPLE];
    sortImages(SAMPLE, "name", "asc");
    expect(SAMPLE.map((image) => image.id)).toEqual(input.map((image) => image.id));
  });
});

describe("filterByFormat", () => {
  it("keeps everything for the all filter", () => {
    expect(filterByFormat(SAMPLE, "all")).toHaveLength(4);
  });

  it("keeps only matching types", () => {
    expect(filterByFormat(SAMPLE, "png").map((image) => image.id)).toEqual(["b"]);
    expect(filterByFormat(SAMPLE, "webp").map((image) => image.id)).toEqual(["d"]);
  });
});

describe("searchImages", () => {
  it("returns the same list for an empty query", () => {
    expect(searchImages(SAMPLE, "   ")).toBe(SAMPLE);
  });

  it("matches by name, case-insensitively", () => {
    expect(searchImages(SAMPLE, "beach").map((image) => image.id)).toEqual(["a", "b"]);
  });

  it("matches by camera model", () => {
    expect(searchImages(SAMPLE, "x100v").map((image) => image.id)).toEqual(["c"]);
  });

  it("matches by format keyword", () => {
    expect(searchImages(SAMPLE, "png").map((image) => image.id)).toEqual(["b"]);
  });

  it("matches by date taken (ISO date)", () => {
    expect(searchImages(SAMPLE, "1970-01-01").map((image) => image.id)).toEqual(["a", "b"]);
  });

  it("requires every token to match", () => {
    expect(searchImages(SAMPLE, "beach png").map((image) => image.id)).toEqual(["b"]);
    expect(searchImages(SAMPLE, "beach receipt")).toHaveLength(0);
  });
});
