import { useEffect, useMemo, useRef, useState } from "react";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";
import { SOCIAL_PRESETS } from "@/core/image-ops/social-presets";
import { jpegPageToPdf } from "@/core/image-ops/jpeg-pdf";
import { ImageProcessorClient } from "@/core/workers/image-processor-client";
import type { CanvasOutput } from "@/core/workers/image-processor-types";
import { Button } from "@/ui/button";

const store = new DexieLibraryStore();

export function CreatePage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [presetId, setPresetId] = useState(SOCIAL_PRESETS[0]?.id ?? "x-profile");
  const [columns, setColumns] = useState(3);
  const [gap, setGap] = useState(16);
  const [background, setBackground] = useState("#ffffff");
  const [output, setOutput] = useState<CanvasOutput>();
  const [outputKind, setOutputKind] = useState<"profile" | "collage">("profile");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | undefined>(undefined);
  const processor = useMemo(() => new ImageProcessorClient(), []);
  const selectedImages = useMemo(
    () => images.filter((image) => selected.has(image.id)),
    [images, selected],
  );
  const preset = SOCIAL_PRESETS.find((item) => item.id === presetId) ?? SOCIAL_PRESETS[0];
  const previewUrl = useMemo(
    () => (output ? URL.createObjectURL(output.blob) : ""),
    [output],
  );

  useEffect(() => {
    let active = true;
    void store
      .listImages()
      .then((rows) => {
        if (active) setImages(rows);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "The library could not be opened.",
        ),
      );
    return () => {
      active = false;
      controller.current?.abort();
      processor.dispose();
    };
  }, [processor]);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function toggle(id: string) {
    setOutput(undefined);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function selectedBlobs(signal: AbortSignal): Promise<Blob[]> {
    if (selectedImages.length > 100)
      throw new Error("Choose up to 100 photos for one collage.");
    const blobs: Blob[] = [];
    for (const image of selectedImages) {
      if (signal.aborted) throw new DOMException("The job was cancelled.", "AbortError");
      const blob = await store.getOriginal(image.id);
      if (!blob) throw new Error(`${image.name}: original photo is missing.`);
      blobs.push(blob);
    }
    return blobs;
  }

  async function makeProfile() {
    const image = selectedImages[0];
    if (!image || !preset) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setError("");
    setOutput(undefined);
    setOutputKind("profile");
    setProgress("Creating profile image…");
    try {
      const source = await store.getOriginal(image.id);
      if (!source) throw new Error("The original photo is missing.");
      const result = await processor.createProfile(
        source,
        preset.width,
        preset.height,
        preset.mask,
        abort.signal,
      );
      if (!abort.signal.aborted) {
        setOutput(result);
        setProgress(
          `${result.width} × ${result.height} ${result.blob.type.replace("image/", "").toUpperCase()} ready.`,
        );
      }
    } catch (caught) {
      if (!abort.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : "The profile image could not be created.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  async function makeCollage() {
    if (!selectedImages.length) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setError("");
    setOutput(undefined);
    setOutputKind("collage");
    setProgress("Creating contact sheet…");
    try {
      const sources = await selectedBlobs(abort.signal);
      const result = await processor.createCollage(
        sources,
        { width: 1800, cellHeight: 420, columns, gap, background },
        abort.signal,
      );
      if (!abort.signal.aborted) {
        setOutput(result);
        setProgress(
          `${sources.length} photos · ${result.width} × ${result.height} contact sheet ready.`,
        );
      }
    } catch (caught) {
      if (!abort.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : "The contact sheet could not be created.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  async function downloadOutput() {
    if (!output) return;
    download(
      output.blob,
      outputKind === "profile"
        ? `vista-profile.${extension(output.blob.type)}`
        : "vista-collage.jpg",
    );
  }

  async function downloadPdf() {
    if (!output || outputKind !== "collage") return;
    try {
      const pdf = await jpegPageToPdf(output.blob, output.width, output.height);
      download(pdf, "vista-contact-sheet.pdf");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The contact sheet PDF could not be created.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
          Make a new image
        </p>
        <h1 className="mt-2 font-display text-[30px] text-ink">Create</h1>
        <p className="mt-2 text-sm text-muted">
          Profile pictures, collages, and printable contact sheets are created locally.
        </p>
      </header>
      {images.length === 0 ? (
        <p className="rounded-lg border border-line p-8 text-center text-muted">
          Add photos in Library to create images.
        </p>
      ) : (
        <>
          <section
            aria-label="Choose photos"
            className="mb-5 rounded-lg border border-line bg-surface p-4"
          >
            <div className="mb-3 flex flex-wrap justify-between gap-3">
              <h2 className="font-display text-lg text-ink">
                Photos ({selected.size} selected)
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setOutput(undefined);
                    setSelected(new Set(images.slice(0, 100).map((image) => image.id)));
                  }}
                >
                  Select up to 100
                </Button>
                <Button
                  onClick={() => {
                    setOutput(undefined);
                    setSelected(new Set());
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {images.map((image) => (
                <li key={image.id}>
                  <label className="flex items-center gap-2 rounded border border-line p-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={selected.has(image.id)}
                      onChange={() => toggle(image.id)}
                    />
                    <span className="truncate">{image.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-3 rounded-lg border border-line bg-raised p-4">
              <h2 className="font-display text-lg text-ink">Profile and social images</h2>
              <label className="block text-xs text-muted">
                Preset
                <select
                  aria-label="Social preset"
                  value={presetId}
                  onChange={(event) => {
                    setPresetId(event.currentTarget.value);
                    setOutput(undefined);
                  }}
                  className="mt-1 block w-full rounded border border-line bg-surface p-2 text-ink"
                >
                  {SOCIAL_PRESETS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} · {item.width} × {item.height}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted">
                The selected photo is center-cropped to fill the preset. Circle masks export
                transparent PNG.
              </p>
              <Button onClick={() => void makeProfile()} disabled={!selected.size || busy}>
                Create profile image from first selected photo
              </Button>
            </section>
            <section className="space-y-3 rounded-lg border border-line bg-raised p-4">
              <h2 className="font-display text-lg text-ink">Collage and contact sheet</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted">
                  Columns
                  <input
                    aria-label="Collage columns"
                    type="number"
                    min="1"
                    max="10"
                    value={columns}
                    onChange={(event) =>
                      setColumns(
                        Math.max(1, Math.min(10, Number(event.currentTarget.value))),
                      )
                    }
                    className="mt-1 block w-full rounded border border-line bg-surface p-2 text-ink"
                  />
                </label>
                <label className="text-xs text-muted">
                  Spacing
                  <input
                    aria-label="Collage spacing"
                    type="number"
                    min="0"
                    max="100"
                    value={gap}
                    onChange={(event) =>
                      setGap(Math.max(0, Math.min(100, Number(event.currentTarget.value))))
                    }
                    className="mt-1 block w-full rounded border border-line bg-surface p-2 text-ink"
                  />
                </label>
                <label className="col-span-2 flex items-center justify-between text-xs text-muted">
                  Background
                  <input
                    aria-label="Collage background"
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.currentTarget.value)}
                  />
                </label>
              </div>
              <Button onClick={() => void makeCollage()} disabled={!selected.size || busy}>
                Create collage / contact sheet
              </Button>
            </section>
          </div>
          {busy && (
            <Button onClick={() => controller.current?.abort()} className="mt-4">
              Cancel
            </Button>
          )}
          {progress && (
            <p role="status" className="mt-4 text-sm text-muted">
              {progress}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded border border-line p-3 text-sm text-accent"
            >
              {error}
            </p>
          )}
          {output && (
            <section
              aria-label="Created image"
              className="mt-5 rounded-lg border border-line bg-raised p-4"
            >
              <img
                src={previewUrl}
                alt={
                  outputKind === "profile"
                    ? "Profile image preview"
                    : "Contact sheet preview"
                }
                className="mx-auto max-h-[60vh] max-w-full object-contain"
              />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button onClick={() => void downloadOutput()}>Download image</Button>
                {outputKind === "collage" && (
                  <Button onClick={() => void downloadPdf()}>
                    Download PDF contact sheet
                  </Button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function extension(mimeType: string): string {
  return mimeType === "image/jpeg" ? "jpg" : (mimeType.split("/")[1] ?? "png");
}
