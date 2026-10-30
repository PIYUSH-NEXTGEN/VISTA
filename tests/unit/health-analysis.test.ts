import { describe, expect, it } from "vitest";
import {
  groupExactDuplicates,
  groupNearDuplicates,
  imageHealthFlags,
} from "@/core/image-ops/health-analysis";
import type { ImageRecord } from "@/core/storage/models";

function image(
  id: string,
  contentHash: string,
  perceptualHash: string,
  overrides: Partial<ImageRecord> = {},
): ImageRecord {
  return {
    id,
    name: `${id}.png`,
    mimeType: "image/png",
    sizeBytes: 1000,
    width: 1920,
    height: 1080,
    importedAt: 1,
    contentHash,
    perceptualHash,
    ...overrides,
  };
}

describe("library health grouping", () => {
  it("groups exact copies by content hash", () => {
    const rows = [
      image("one", "same", "0000000000000000"),
      image("two", "same", "ffffffffffffffff"),
      image("three", "other", "0000000000000000"),
    ];
    expect(
      groupExactDuplicates(rows).map((group) => group.images.map((row) => row.id)),
    ).toEqual([["one", "two"]]);
  });

  it("uses perceptual hash distance to find similar photos in buckets", () => {
    const rows = [
      image("base", "a", "0000000000000000"),
      image("near", "b", "0000000000000007"),
      image("far", "c", "ffffffffffffffff"),
    ];
    expect(
      groupNearDuplicates(rows).map((group) => group.images.map((row) => row.id)),
    ).toEqual([["base", "near"]]);
  });

  it("flags low-resolution, dark, and low-focus photos with stable thresholds", () => {
    expect(
      imageHealthFlags(
        image("weak", "a", "0000000000000000", {
          width: 640,
          height: 480,
          quality: { brightness: 40, focusScore: 2, analyzedAt: 1 },
        }),
      ),
    ).toEqual(["Low resolution", "Dark", "Possibly blurry"]);
  });

  it("smoke-tests exact and near grouping with 5,000 generated library records", () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => {
      const hash = BigInt(index) * 0x9e3779b97f4a7c15n;
      return image(
        `generated-${index}`,
        index.toString(16).padStart(64, "0"),
        hash.toString(16).padStart(16, "0"),
      );
    });
    const startedAt = performance.now();
    const exact = groupExactDuplicates(rows);
    const near = groupNearDuplicates(rows);
    const elapsedMs = performance.now() - startedAt;

    console.log(`Health grouping: 5,000 records in ${elapsedMs.toFixed(1)} ms.`);
    expect(exact).toHaveLength(0);
    expect(near).toHaveLength(0);
  });
});
