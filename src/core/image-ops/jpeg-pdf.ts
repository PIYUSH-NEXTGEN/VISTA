/** Wraps one locally rendered JPEG page in a minimal PDF 1.4 container. */
export async function jpegPageToPdf(
  jpeg: Blob,
  width: number,
  height: number,
): Promise<Blob> {
  if (jpeg.type !== "image/jpeg")
    throw new Error("PDF contact sheets require a JPEG render.");
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new RangeError("PDF page dimensions are invalid.");
  const imageBytes = new Uint8Array(await jpeg.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let length = 0;
  const append = (part: Uint8Array) => {
    chunks.push(part);
    length += part.byteLength;
  };
  const text = (value: string) => new TextEncoder().encode(value);
  append(text("%PDF-1.4\n"));
  const offsets = [0];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  ];
  for (const [index, body] of objects.entries()) {
    offsets.push(length);
    append(text(`${index + 1} 0 obj\n${body}\nendobj\n`));
  }
  offsets.push(length);
  append(
    text(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.byteLength} >>\nstream\n`,
    ),
  );
  append(imageBytes);
  append(text("\nendstream\nendobj\n"));
  const pageCommands = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(length);
  append(
    text(
      `5 0 obj\n<< /Length ${text(pageCommands).byteLength} >>\nstream\n${pageCommands}endstream\nendobj\n`,
    ),
  );
  const xrefOffset = length;
  append(
    text(
      `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join(
          "",
        )}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    ),
  );
  const pdf = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Blob([pdf.buffer], { type: "application/pdf" });
}
