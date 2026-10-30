import { describe, expect, it } from "vitest";
import { validateEditStack } from "@/core/edit-stack/schema";

describe("edit stack schema", () => {
  it("accepts supported reversible edit steps", () => {
    expect(
      validateEditStack({
        version: 1,
        steps: [
          { type: "crop", x: 0, y: 0, width: 0.5, height: 0.5 },
          { type: "rotate", degrees: 90 },
          { type: "flip", horizontal: true, vertical: false },
          { type: "resize", width: 320, height: 240 },
          { type: "adjust", brightness: 10, contrast: 0, saturation: 20, sharpness: 0.2 },
        ],
      }),
    ).toMatchObject({
      version: 1,
      steps: [
        { type: "crop" },
        { type: "rotate" },
        { type: "flip" },
        { type: "resize" },
        { type: "adjust" },
      ],
    });
  });

  it.each([
    { version: 2, steps: [] },
    { version: 1, steps: [{ type: "crop", x: -0.1, y: 0, width: 1, height: 1 }] },
    { version: 1, steps: [{ type: "rotate", degrees: 45 }] },
    { version: 1, steps: [{ type: "resize", width: 0, height: 50 }] },
    { version: 1, steps: [{ type: "resize", width: 16000, height: 16000 }] },
    {
      version: 1,
      steps: [
        { type: "adjust", brightness: 101, contrast: 0, saturation: 0, sharpness: 0 },
      ],
    },
    { version: 1, steps: [{ type: "unknown" }] },
  ])("rejects malformed or unsupported edits", (value) => {
    expect(() => validateEditStack(value)).toThrow();
  });
});
