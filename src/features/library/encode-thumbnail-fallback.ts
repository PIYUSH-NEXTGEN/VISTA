import type { ThumbnailData } from "@/core/workers/image-processor-types";

export async function encodeThumbnailFallback(data: ThumbnailData): Promise<Blob> {
  if (data.kind === "blob") return data.blob;

  const { bitmap } = data;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  try {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not encode the small image preview in this browser.");
    }
    context.drawImage(bitmap, 0, 0);
    const webp = await toBlob(canvas, "image/webp", 0.82);
    return webp.type === "image/webp" ? webp : toBlob(canvas, "image/png");
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode the image preview."));
      },
      type,
      quality,
    );
  });
}
