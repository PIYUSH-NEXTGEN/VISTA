import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Comlink from "comlink";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";
import type { AlbumSummary } from "@/core/storage/library-store";
import { validateEditStack } from "@/core/edit-stack/schema";
import { ImageProcessorClient } from "@/core/workers/image-processor-client";
import type { EncodedImage } from "@/core/workers/image-processor-types";
import { Button } from "@/ui/button";

const store = new DexieLibraryStore();
const FORMATS = [
  { type: "image/jpeg", label: "JPEG" },
  { type: "image/png", label: "PNG" },
  { type: "image/webp", label: "WebP" },
  { type: "image/avif", label: "AVIF" },
] as const;

export function ToolsPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [supportsDirectoryInput] = useState(
    () => "webkitdirectory" in document.createElement("input"),
  );
  const [scope, setScope] = useState<"selection" | "album" | "folder">("selection");
  const [albumId, setAlbumId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [quality, setQuality] = useState(0.82);
  const [targetMode, setTargetMode] = useState(false);
  const [targetKb, setTargetKb] = useState(200);
  const [stripLocation, setStripLocation] = useState(false);
  const [applySavedEdits, setApplySavedEdits] = useState(false);
  const [preview, setPreview] = useState<EncodedImage>();
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const folderFiles = useRef<Map<string, File>>(new Map());
  const processor = useMemo(() => new ImageProcessorClient(), []);
  const selectedImages = useMemo(
    () => images.filter((image) => selected.has(image.id)),
    [images, selected],
  );
  const encode = useCallback(
    async (image: ImageRecord, signal: AbortSignal) => {
      const original =
        folderFiles.current.get(image.id) ?? (await store.getOriginal(image.id));
      if (!original) throw new Error(`${image.name}: original image is missing.`);
      const targetBytes = targetMode ? targetKb * 1024 : undefined;
      return processor.encode(original, mimeType, quality, targetBytes, signal);
    },
    [mimeType, processor, quality, targetKb, targetMode],
  );

  useEffect(() => {
    let active = true;
    void store
      .listImages()
      .then(async (rows) => {
        const listedAlbums = await store.listAlbums();
        if (active) {
          setImages(rows);
          setAlbums(listedAlbums);
        }
      })
      .catch((error: unknown) =>
        setErrors([
          error instanceof Error ? error.message : "The library could not be opened.",
        ]),
      );
    return () => {
      active = false;
      controller.current?.abort();
      processor.dispose();
    };
  }, [processor]);

  const firstSelectedId = selectedImages[0]?.id;
  useEffect(() => {
    const first = images.find((image) => image.id === firstSelectedId);
    if (!first) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    const timer = setTimeout(() => {
      void (async () => {
        setBusy(true);
        setProgress("Updating size preview…");
        try {
          const result = await encode(first, abort.signal);
          if (!abort.signal.aborted) setPreview(result);
        } catch (error) {
          if (!abort.signal.aborted) {
            setPreview(undefined);
            setErrors([
              error instanceof Error ? error.message : "The preview could not be encoded.",
            ]);
          }
        } finally {
          if (!abort.signal.aborted) {
            setBusy(false);
            setProgress("");
          }
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [encode, firstSelectedId, images]);

  function toggle(id: string) {
    setPreview(undefined);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function chooseScope(next: "selection" | "album" | "folder") {
    setScope(next);
    setPreview(undefined);
    setSelected(new Set());
    folderFiles.current.clear();
    if (next === "selection") {
      setImages(await store.listImages());
      return;
    }
    if (next === "album") {
      const id = albumId || albums[0]?.album.id;
      if (!id) {
        setImages([]);
        setErrors(["Create an album in Library before choosing album batch scope."]);
        return;
      }
      setAlbumId(id);
      const rows = await store.listAlbumImages(id);
      setImages(rows);
      setSelected(new Set(rows.map((image) => image.id)));
    }
  }

  function loadFolderFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = [...fileList].filter((file) => file.type.startsWith("image/"));
    const rows = files.map((file): ImageRecord => {
      const id = crypto.randomUUID();
      folderFiles.current.set(id, file);
      return {
        id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        width: 1,
        height: 1,
        importedAt: file.lastModified || Date.now(),
        contentHash: `folder-${id}`,
      };
    });
    setImages(rows);
    setSelected(new Set(rows.map((row) => row.id)));
    setErrors(files.length === 0 ? ["The selected folder contained no image files."] : []);
    setProgress(`${files.length} image files selected from the folder.`);
  }

  async function getExportBlob(
    image: ImageRecord,
    signal = new AbortController().signal,
  ): Promise<Blob> {
    const original =
      folderFiles.current.get(image.id) ?? (await store.getOriginal(image.id));
    if (!original) throw new Error(`${image.name}: original image is missing.`);
    if (!stripLocation) return original;
    return (await processor.encode(original, image.mimeType, 0.92, undefined, signal)).blob;
  }

  async function previewSize() {
    const first = selectedImages[0];
    if (!first) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setErrors([]);
    setPreview(undefined);
    setProgress("Creating a size preview…");
    try {
      setPreview(await encode(first, abort.signal));
      setProgress("");
    } catch (error) {
      if (!abort.signal.aborted) {
        setErrors([
          error instanceof Error ? error.message : "The preview could not be encoded.",
        ]);
        setProgress("");
      }
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  async function runBatch() {
    if (!selectedImages.length) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setErrors([]);
    setProgress("Starting…");
    const failures: string[] = [];
    let completed = 0;
    for (const image of selectedImages) {
      if (abort.signal.aborted) break;
      setProgress(`Converting ${completed + 1} of ${selectedImages.length}: ${image.name}`);
      try {
        let source =
          folderFiles.current.get(image.id) ?? (await store.getOriginal(image.id));
        if (!source) throw new Error(`${image.name}: original image is missing.`);
        if (applySavedEdits && !folderFiles.current.has(image.id)) {
          const edit = await store.getEdit(image.id);
          if (edit?.steps.length) {
            const stack = validateEditStack({ version: 1, steps: edit.steps });
            source = (await processor.renderEdits(source, stack.steps, abort.signal))
              .rendered;
          }
        }
        const output = await processor.encode(
          source,
          mimeType,
          quality,
          targetMode ? targetKb * 1024 : undefined,
          abort.signal,
        );
        const copy: ImageRecord = {
          ...image,
          id: crypto.randomUUID(),
          name: convertedName(image.name, mimeType),
          mimeType: output.blob.type,
          sizeBytes: output.blob.size,
          width: output.width,
          height: output.height,
          importedAt: Date.now(),
          contentHash: output.contentHash,
          deletedAt: undefined,
        };
        delete copy.deletedAt;
        await store.addImage(copy, output.blob, output.thumbnail);
        completed += 1;
      } catch (error) {
        if (abort.signal.aborted) break;
        const details = error instanceof Error ? error.message : "conversion failed.";
        failures.push(
          details.startsWith(`${image.name}:`) ? details : `${image.name}: ${details}`,
        );
      }
    }
    setErrors(failures);
    setProgress(
      abort.signal.aborted
        ? `Cancelled after ${completed} files; completed copies remain saved.`
        : `${completed} of ${selectedImages.length} copies saved.`,
    );
    setBusy(false);
    void store.listImages().then(setImages);
  }

  async function exportSelected() {
    if (!selectedImages.length) return;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setErrors([]);
    setProgress("Preparing export…");
    try {
      const rows: { name: string; blob: Blob }[] = [];
      for (const image of selectedImages) {
        if (abort.signal.aborted)
          throw new DOMException("The export was cancelled.", "AbortError");
        const blob = await getExportBlob(image, abort.signal);
        rows.push({
          name: uniqueExportName(
            safeDownloadName(image.name),
            rows.map((row) => row.name),
          ),
          blob,
        });
      }
      if (rows.length === 1)
        download(rows[0]?.blob ?? new Blob(), rows[0]?.name ?? "photo");
      else {
        const worker = new Worker(
          new URL("../../core/workers/export.worker.ts", import.meta.url),
          { type: "module", name: "vista-export" },
        );
        try {
          const remote = Comlink.wrap<{
            zipFiles(rows: { name: string; blob: Blob }[]): Promise<Blob>;
          }>(worker);
          const archive = await remote.zipFiles(rows);
          download(archive, "vista-export.zip");
        } finally {
          worker.terminate();
        }
      }
      setProgress(
        `Exported ${rows.length} file${rows.length === 1 ? "" : "s"}. ${stripLocation ? "Metadata, including location, was removed by re-encoding." : "Original metadata was retained."}`,
      );
    } catch (error) {
      if (!abort.signal.aborted) {
        setErrors([
          error instanceof Error ? error.message : "The files could not be exported.",
        ]);
        setProgress("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function shareSelected() {
    if (!selectedImages.length) return;
    const files: File[] = [];
    try {
      for (const image of selectedImages) {
        const blob = await getExportBlob(image);
        files.push(
          new File([blob], safeDownloadName(image.name), {
            type: blob.type || image.mimeType,
          }),
        );
      }
      if (navigator.canShare?.({ files }) && navigator.share) {
        await navigator.share({ files, title: "VISTA photos" });
        setProgress(`Shared ${files.length} file${files.length === 1 ? "" : "s"}.`);
      } else {
        setProgress("File sharing is unavailable; preparing a download instead.");
        await exportSelected();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrors(["The share sheet could not be opened. Preparing a download instead."]);
      await exportSelected();
    }
  }

  async function writeToFolder() {
    const picker = (
      window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> }
    ).showDirectoryPicker;
    if (!picker) {
      setErrors([
        "Folder export is not available in this browser. Use Download export instead.",
      ]);
      return;
    }
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setErrors([]);
    try {
      const directory = await picker();
      const written: string[] = [];
      const failures: string[] = [];
      for (const [index, image] of selectedImages.entries()) {
        if (abort.signal.aborted) break;
        setProgress(`Writing ${index + 1} of ${selectedImages.length}: ${image.name}`);
        try {
          const blob = await getExportBlob(image, abort.signal);
          const name = uniqueExportName(safeDownloadName(image.name), written);
          const file = await directory.getFileHandle(name, { create: true });
          const writable = await file.createWritable();
          await writable.write(blob);
          await writable.close();
          written.push(name);
        } catch (error) {
          if (abort.signal.aborted) break;
          failures.push(
            error instanceof Error ? error.message : `${image.name}: write failed.`,
          );
        }
      }
      setErrors(failures);
      setProgress(
        abort.signal.aborted
          ? `Cancelled after writing ${written.length} files.`
          : `Wrote ${written.length} of ${selectedImages.length} files to the selected folder.`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setProgress("");
      } else if (!abort.signal.aborted) {
        setErrors([error instanceof Error ? error.message : "Folder export failed."]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
          Local processing
        </p>
        <h1 className="mt-2 font-display text-[30px] text-ink">Tools</h1>
        <p className="mt-2 text-sm text-muted">
          Convert, compress, and export photo copies. Originals remain unchanged.
        </p>
      </header>
      {images.length === 0 ? (
        <p className="rounded-lg border border-line p-8 text-center text-muted">
          Add photos in Library to use these tools.
        </p>
      ) : (
        <>
          <section
            aria-label="Choose photos"
            className="mb-6 rounded-lg border border-line bg-surface p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg text-ink">
                Photos ({selected.size} selected)
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setPreview(undefined);
                    setSelected(new Set(images.map((image) => image.id)));
                  }}
                >
                  Select all
                </Button>
                <Button
                  onClick={() => {
                    setPreview(undefined);
                    setSelected(new Set());
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted">
                Batch source
                <select
                  aria-label="Batch source"
                  value={scope}
                  onChange={(event) =>
                    void chooseScope(event.currentTarget.value as typeof scope)
                  }
                  className="mt-1 block rounded border border-line bg-surface p-2 text-ink"
                >
                  <option value="selection">Library selection</option>
                  <option value="album">Album</option>
                  <option value="folder">Folder files</option>
                </select>
              </label>
              {scope === "album" && (
                <label className="text-xs text-muted">
                  Album
                  <select
                    aria-label="Batch album"
                    value={albumId}
                    onChange={async (event) => {
                      const id = event.currentTarget.value;
                      setAlbumId(id);
                      const rows = await store.listAlbumImages(id);
                      setImages(rows);
                      setSelected(new Set(rows.map((row) => row.id)));
                    }}
                    className="mt-1 block rounded border border-line bg-surface p-2 text-ink"
                  >
                    {albums.map(({ album }) => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {scope === "folder" && (
                <label className="text-xs text-muted">
                  {supportsDirectoryInput
                    ? "Choose folder images"
                    : "Choose multiple images from one folder"}
                  <input
                    aria-label="Choose folder images"
                    type="file"
                    accept="image/*"
                    multiple
                    {...(supportsDirectoryInput
                      ? ({ webkitdirectory: "" } as Record<string, string>)
                      : {})}
                    onChange={(event) => loadFolderFiles(event.currentTarget.files)}
                    className="mt-1 block max-w-full text-ink"
                  />
                  {!supportsDirectoryInput && (
                    <span className="mt-1 block">
                      Folder picking is unavailable in this browser; select its images
                      individually.
                    </span>
                  )}
                </label>
              )}
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
                    <span className="min-w-0 flex-1 truncate">{image.name}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {formatBytes(image.sizeBytes)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
          <section
            aria-label="Convert and compress"
            className="mb-6 grid gap-4 rounded-lg border border-line bg-raised p-4 sm:grid-cols-2"
          >
            <label className="text-xs text-muted">
              Output format
              <select
                aria-label="Output format"
                value={mimeType}
                onChange={(event) => {
                  setMimeType(event.currentTarget.value);
                  setPreview(undefined);
                }}
                className="mt-1 block w-full rounded border border-line bg-surface p-2 text-ink"
              >
                {FORMATS.map((format) => (
                  <option key={format.type} value={format.type}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Quality: {Math.round(quality * 100)}%
              <input
                aria-label="Quality"
                type="range"
                min="5"
                max="100"
                value={Math.round(quality * 100)}
                onChange={(event) => {
                  setQuality(Number(event.currentTarget.value) / 100);
                  setPreview(undefined);
                }}
                className="mt-1 block w-full"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={targetMode}
                onChange={(event) => {
                  setPreview(undefined);
                  setTargetMode(event.currentTarget.checked);
                }}
              />
              Target size
            </label>
            {targetMode && (
              <label className="text-xs text-muted">
                Maximum KB
                <input
                  aria-label="Maximum KB"
                  type="number"
                  min="1"
                  max="50000"
                  value={targetKb}
                  onChange={(event) => {
                    setPreview(undefined);
                    setTargetKb(Math.max(1, Number(event.currentTarget.value)));
                  }}
                  className="mt-1 block w-full rounded border border-line bg-surface p-2 text-ink"
                />
              </label>
            )}
            <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
              <input
                type="checkbox"
                checked={stripLocation}
                onChange={(event) => setStripLocation(event.currentTarget.checked)}
              />
              Re-encode exports to remove metadata, including location. Turn this off to
              export originals with their metadata intact.
            </label>
            <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
              <input
                type="checkbox"
                checked={applySavedEdits}
                onChange={(event) => setApplySavedEdits(event.currentTarget.checked)}
                disabled={scope === "folder"}
              />
              Apply each library photo’s saved edit stack before conversion.
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button onClick={() => void previewSize()} disabled={!selected.size || busy}>
                Preview size
              </Button>
              <Button onClick={() => void runBatch()} disabled={!selected.size || busy}>
                Convert batch as copies
              </Button>
              <Button
                onClick={() => void exportSelected()}
                disabled={!selected.size || busy}
              >
                Export selected
              </Button>
              <Button
                onClick={() => void shareSelected()}
                disabled={!selected.size || busy}
              >
                Share
              </Button>
              <Button
                onClick={() => void writeToFolder()}
                disabled={!selected.size || busy}
              >
                Write to folder
              </Button>
              {busy && <Button onClick={() => controller.current?.abort()}>Cancel</Button>}
            </div>
          </section>
          {preview && (
            <p
              className="mb-4 rounded border border-line p-3 text-sm text-ink"
              role="status"
            >
              Preview: {formatBytes(preview.blob.size)} at{" "}
              {Math.round(preview.quality * 100)}% quality.
            </p>
          )}
          {progress && (
            <p className="mb-4 text-sm text-muted" role="status">
              {progress}
            </p>
          )}
          {errors.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded border border-line p-3 text-sm text-accent"
            >
              {errors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

interface DirectoryHandle {
  getFileHandle(
    name: string,
    options: { create: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeDownloadName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join("")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 150);
  return safe || "photo";
}

function uniqueExportName(name: string, existing: string[]): string {
  if (!existing.includes(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  while (existing.includes(`${stem} (${index})${extension}`)) index += 1;
  return `${stem} (${index})${extension}`;
}

function convertedName(name: string, mimeType: string): string {
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
  return `${name.replace(/\.[^.]*$/, "")}.${extension}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
