import { useEffect, useMemo, useState } from "react";
import * as Comlink from "comlink";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";
import {
  EMPTY_EDIT_STACK,
  validateEditStack,
  type EditStack,
  type EditStep,
} from "@/core/edit-stack/schema";
import { Button } from "@/ui/button";

const store = new DexieLibraryStore();
type Rendered = {
  rendered: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  contentHash: string;
};

export function EditorPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [imageId, setImageId] = useState("");
  const [stack, setStack] = useState<EditStack>(EMPTY_EDIT_STACK);
  const [history, setHistory] = useState<EditStack[]>([]);
  const [future, setFuture] = useState<EditStack[]>([]);
  const [rendered, setRendered] = useState<Rendered>();
  const [originalUrl, setOriginalUrl] = useState("");
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const image = useMemo(
    () => images.find((item) => item.id === imageId),
    [images, imageId],
  );
  const cropStep = stack.steps.find((step) => step.type === "crop");
  const previewUrl = useMemo(
    () => (rendered ? URL.createObjectURL(rendered.rendered) : ""),
    [rendered],
  );

  useEffect(() => {
    let active = true;
    void store
      .listImages()
      .then((items) => {
        if (active) {
          setImages(items);
          if (items[0]) setImageId(items[0].id);
        }
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Photos could not be loaded."),
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let url = "";
    if (!image) return;
    void Promise.all([store.getOriginal(image.id), store.getEdit(image.id)])
      .then(([blob, edit]) => {
        if (!active) return;
        if (!blob) {
          setError("The original photo is missing from local storage.");
          return;
        }
        url = URL.createObjectURL(blob);
        setOriginalUrl(url);
        setStack(
          edit ? validateEditStack({ version: 1, steps: edit.steps }) : EMPTY_EDIT_STACK,
        );
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "The photo could not be opened.",
        ),
      );
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [image]);

  useEffect(() => {
    let active = true;
    let worker: Worker | undefined;
    if (!image || !originalUrl) return;
    const timer = setTimeout(
      () =>
        void (async () => {
          setBusy(true);
          try {
            const blob = await store.getOriginal(image.id);
            if (!blob) throw new Error("The original photo is missing from local storage.");
            worker = new Worker(
              new URL("../../core/workers/image-processor.worker.ts", import.meta.url),
              { type: "module", name: "vista-edit-renderer" },
            );
            const remote = Comlink.wrap<{
              renderEdits(source: Blob, edits: unknown[]): Promise<Rendered>;
            }>(worker);
            const output = await remote.renderEdits(blob, stack.steps);
            if (active) setRendered(output);
          } catch (caught) {
            if (active)
              setError(
                caught instanceof Error
                  ? caught.message
                  : "The preview could not be rendered.",
              );
          } finally {
            worker?.terminate();
            if (active) setBusy(false);
          }
        })(),
      120,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [image, originalUrl, stack]);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function update(steps: EditStep[]) {
    setHistory((items) => [...items, stack]);
    setFuture([]);
    setStack({ version: 1, steps });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [stack, ...items]);
    setStack(previous);
    setHistory((items) => items.slice(0, -1));
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, stack]);
    setStack(next);
    setFuture((items) => items.slice(1));
  }

  async function saveEdits() {
    if (!image) return;
    try {
      await store.saveEdit({
        imageId: image.id,
        steps: stack.steps,
        cachedRender: rendered?.rendered,
      });
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The edits could not be saved.");
    }
  }

  async function saveCopy() {
    if (!image || !rendered) return;
    setBusy(true);
    try {
      const copy: ImageRecord = {
        ...image,
        id: crypto.randomUUID(),
        name: `Edited ${image.name}`,
        mimeType: rendered.rendered.type || image.mimeType,
        sizeBytes: rendered.rendered.size,
        width: rendered.width,
        height: rendered.height,
        importedAt: Date.now(),
        contentHash: rendered.contentHash,
        deletedAt: undefined,
      };
      delete copy.deletedAt;
      await store.addImage(copy, rendered.rendered, rendered.thumbnail);
      setImages((items) => [copy, ...items]);
      setImageId(copy.id);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The edited copy could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
          Originals stay untouched
        </p>
        <h1 className="mt-2 font-display text-[30px] text-ink">Editor</h1>
        <p className="mt-2 text-sm text-muted">
          Edits are saved as reversible steps on this device.
        </p>
      </header>
      {error && (
        <p role="alert" className="mb-4 rounded border border-line p-3 text-sm text-accent">
          {error}
        </p>
      )}
      {images.length === 0 ? (
        <p className="rounded border border-line p-8 text-center text-muted">
          Add photos in Library to start editing.
        </p>
      ) : (
        <>
          <label className="mb-4 flex items-center gap-3 text-sm text-muted">
            Photo
            <select
              aria-label="Choose photo"
              value={imageId}
              onChange={(event) => {
                setRendered(undefined);
                setOriginalUrl("");
                setError("");
                setHistory([]);
                setFuture([]);
                setStack(EMPTY_EDIT_STACK);
                setImageId(event.currentTarget.value);
              }}
              className="rounded border border-line bg-surface p-2 text-ink"
            >
              {images.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <section className="flex min-h-72 items-center justify-center rounded-lg border border-line bg-surface p-4">
              <div className="relative max-h-[60vh] max-w-full">
                {(compare ? originalUrl : previewUrl) && (
                  <img
                    src={compare ? originalUrl : previewUrl}
                    alt={image?.name ?? "Photo preview"}
                    className="max-h-[60vh] max-w-full object-contain"
                  />
                )}
                {busy && (
                  <p
                    role="status"
                    className="absolute bottom-2 left-2 rounded bg-raised px-2 py-1 text-xs"
                  >
                    Rendering preview…
                  </p>
                )}
              </div>
            </section>
            <section className="space-y-4 rounded-lg border border-line bg-raised p-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={undo} disabled={!history.length}>
                  Undo
                </Button>
                <Button onClick={redo} disabled={!future.length}>
                  Redo
                </Button>
                <Button onClick={() => update([])} disabled={!stack.steps.length}>
                  Reset
                </Button>
                <Button onClick={() => setCompare((value) => !value)}>
                  {compare ? "After" : "Before"}
                </Button>
              </div>
              <fieldset className="space-y-2">
                <legend className="font-mono text-xs uppercase text-muted">Crop</legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Free", ratio: undefined },
                    { label: "Square", ratio: 1 },
                    { label: "4:3", ratio: 4 / 3 },
                    { label: "16:9", ratio: 16 / 9 },
                  ].map(({ label, ratio }) => (
                    <Button
                      key={label}
                      onClick={() => {
                        if (!image) return;
                        const crop =
                          ratio === undefined
                            ? undefined
                            : centeredAspectCrop(image, ratio);
                        update([
                          ...(crop ? [crop] : []),
                          ...stack.steps.filter((step) => step.type !== "crop"),
                        ]);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["x", "y", "width", "height"] as const).map((key) => (
                    <label key={key} className="text-xs text-muted">
                      {key}
                      <input
                        aria-label={`Crop ${key}`}
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={
                          cropStep?.[key] ?? (key === "width" || key === "height" ? 1 : 0)
                        }
                        onChange={(event) => {
                          const crop = {
                            type: "crop" as const,
                            x: 0,
                            y: 0,
                            width: 1,
                            height: 1,
                            ...(stack.steps.find((step) => step.type === "crop") ?? {}),
                            [key]: Number(event.currentTarget.value),
                          };
                          update([
                            crop,
                            ...stack.steps.filter((step) => step.type !== "crop"),
                          ]);
                        }}
                        className="mt-1 w-full rounded border border-line bg-surface p-1.5 text-ink"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => update([...stack.steps, { type: "rotate", degrees: 90 }])}
                >
                  Rotate 90°
                </Button>
                <Button
                  onClick={() =>
                    update([
                      ...stack.steps,
                      { type: "flip", horizontal: true, vertical: false },
                    ])
                  }
                >
                  Flip horizontal
                </Button>
                <Button
                  onClick={() =>
                    update([
                      ...stack.steps,
                      { type: "flip", horizontal: false, vertical: true },
                    ])
                  }
                >
                  Flip vertical
                </Button>
              </div>
              <fieldset className="space-y-2">
                <legend className="font-mono text-xs uppercase text-muted">Adjust</legend>
                {(["brightness", "contrast", "saturation", "sharpness"] as const).map(
                  (key) => (
                    <label key={key} className="block text-xs capitalize text-muted">
                      {key}
                      <input
                        aria-label={key}
                        type="range"
                        min={key === "sharpness" ? -1 : -100}
                        max={key === "sharpness" ? 1 : 100}
                        step="1"
                        value={
                          stack.steps.find((step) => step.type === "adjust")?.[key] ?? 0
                        }
                        onChange={(event) => {
                          const old = stack.steps.find((step) => step.type === "adjust");
                          const adjust = {
                            type: "adjust" as const,
                            brightness: 0,
                            contrast: 0,
                            saturation: 0,
                            sharpness: 0,
                            ...old,
                            [key]: Number(event.currentTarget.value),
                          };
                          update([
                            ...stack.steps.filter((step) => step.type !== "adjust"),
                            adjust,
                          ]);
                        }}
                        className="block w-full"
                      />
                    </label>
                  ),
                )}
              </fieldset>
              <label className="block text-xs text-muted">
                Resize width
                <input
                  aria-label="Resize width"
                  type="number"
                  min="1"
                  max="16000"
                  value={
                    stack.steps.find((step) => step.type === "resize")?.width ??
                    image?.width ??
                    1
                  }
                  onChange={(event) => {
                    const width = Number(event.currentTarget.value);
                    if (width > 0 && width <= 16000)
                      update([
                        ...stack.steps.filter((step) => step.type !== "resize"),
                        {
                          type: "resize",
                          width,
                          height: Math.max(
                            1,
                            Math.round(
                              (width * (image?.height ?? 1)) / (image?.width ?? 1),
                            ),
                          ),
                        },
                      ]);
                  }}
                  className="mt-1 w-full rounded border border-line bg-surface p-1.5 text-ink"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveEdits()} disabled={busy}>
                  Save edit steps
                </Button>
                <Button
                  onClick={() => void saveCopy()}
                  disabled={busy || !rendered || stack.steps.length === 0}
                >
                  Save as new copy
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

function centeredAspectCrop(
  image: ImageRecord,
  targetRatio: number,
): Extract<EditStep, { type: "crop" }> {
  const imageRatio = image.width / image.height;
  if (imageRatio > targetRatio) {
    const width = targetRatio / imageRatio;
    return { type: "crop", x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = imageRatio / targetRatio;
  return { type: "crop", x: 0, y: (1 - height) / 2, width: 1, height };
}
