import { describe, expect, it } from "vitest";
import { findBestQuality } from "@/core/image-ops/target-size";

describe("target-size quality search", () => {
  it("chooses the highest encoded quality under the requested byte limit", async () => {
    const result = await findBestQuality(700, async (quality) => ({
      value: `q${quality}`,
      sizeBytes: Math.round(quality * 1000),
    }));
    expect(result.sizeBytes).toBeLessThanOrEqual(700);
    expect(result.quality).toBeGreaterThan(0.69);
  });

  it("reports the smallest measured result when the target cannot be reached", async () => {
    await expect(
      findBestQuality(20, async () => ({ value: "image", sizeBytes: 45 })),
    ).rejects.toThrow(/Smallest result: 45 bytes/);
  });

  it("rejects invalid target sizes and search budgets", async () => {
    await expect(
      findBestQuality(0, async () => ({ value: "", sizeBytes: 1 })),
    ).rejects.toThrow(/positive/);
    await expect(
      findBestQuality(1, async () => ({ value: "", sizeBytes: 1 }), 17),
    ).rejects.toThrow(/1 to 16/);
  });
});
