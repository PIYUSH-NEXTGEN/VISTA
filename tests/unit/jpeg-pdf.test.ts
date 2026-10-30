import { describe, expect, it } from "vitest";
import { jpegPageToPdf } from "@/core/image-ops/jpeg-pdf";

describe("jpegPageToPdf", () => {
  it("creates a single-page PDF with a JPEG image object and valid cross-reference", async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: "image/jpeg",
    });
    const pdf = await jpegPageToPdf(jpeg, 400, 300);
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const text = new TextDecoder().decode(bytes);

    expect(pdf.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 400 300]");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("xref\n0 6\n");
    const startXref = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(new TextDecoder().decode(bytes.slice(startXref, startXref + 4))).toBe("xref");
    expect(text.endsWith("%%EOF")).toBe(true);
  });

  it("rejects non-JPEG inputs and invalid dimensions", async () => {
    await expect(
      jpegPageToPdf(new Blob(["not jpeg"], { type: "image/png" }), 10, 10),
    ).rejects.toThrow("require a JPEG");
    await expect(
      jpegPageToPdf(new Blob([], { type: "image/jpeg" }), 0, 10),
    ).rejects.toThrow("dimensions are invalid");
  });
});
