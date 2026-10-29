import { describe, expect, it } from "vitest";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_PIXEL_COUNT,
  isValidFile,
  validateFileLimits,
} from "@/core/limits";

describe("core/limits", () => {
  it("accepts a normal photo", () => {
    expect(isValidFile(4_000_000, 4000, 3000)).toBe(true);
  });

  it("rejects a file over the size limit", () => {
    const errors = validateFileLimits(MAX_FILE_SIZE_BYTES + 1, 1000, 1000);
    expect(errors).toEqual([
      {
        kind: "tooLarge",
        sizeBytes: MAX_FILE_SIZE_BYTES + 1,
        maxBytes: MAX_FILE_SIZE_BYTES,
      },
    ]);
  });

  it("rejects a >100 MP image (decompression bomb guard)", () => {
    const errors = validateFileLimits(1_000_000, 10_000, MAX_PIXEL_COUNT / 10_000 + 1);
    expect(errors).toEqual([
      { kind: "tooManyPixels", pixels: 100_010_000, maxPixels: MAX_PIXEL_COUNT },
    ]);
  });

  it("rejects impossible dimensions before computing pixel count", () => {
    const errors = validateFileLimits(100, 0, 100);
    expect(errors).toEqual([{ kind: "impossibleDimension", dimension: 0 }]);
  });

  it("rejects non-integer dimensions", () => {
    const errors = validateFileLimits(100, 100.5, 100);
    expect(errors).toEqual([{ kind: "impossibleDimension", dimension: 100.5 }]);
  });
});
