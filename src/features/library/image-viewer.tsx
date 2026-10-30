import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ImageRecord } from "@/core/storage/models";
import type { LibraryStore } from "@/core/storage/library-store";

interface ImageViewerProps {
  image: ImageRecord;
  store: LibraryStore;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

interface Point {
  x: number;
  y: number;
}

export function ImageViewer({
  image,
  store,
  onClose,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: ImageViewerProps) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const pointerOrigin = useRef<Point | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    void store
      .getOriginal(image.id)
      .then((blob) => {
        if (!blob) throw new Error("The original image is missing from this library.");
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "The image could not be opened.",
          );
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, store]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && canGoPrevious) onPrevious();
      if (event.key === "ArrowRight" && canGoNext) onNext();
      if (event.key === "+" || event.key === "=") changeScale(0.25);
      if (event.key === "-") changeScale(-0.25);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoNext, canGoPrevious, onNext, onPrevious]);

  function changeScale(delta: number) {
    setScale((current) => {
      const next = Math.min(4, Math.max(1, current + delta));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (scale === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerOrigin.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    if (!pointerOrigin.current) return;
    setOffset({
      x: event.clientX - pointerOrigin.current.x,
      y: event.clientY - pointerOrigin.current.y,
    });
  }

  function stopPan() {
    pointerOrigin.current = undefined;
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          aria-describedby="image-viewer-description"
          className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-raised text-ink shadow-panel focus:outline-none sm:inset-6"
        >
          <Dialog.Title className="sr-only">Image viewer: {image.name}</Dialog.Title>
          <Dialog.Description id="image-viewer-description" className="sr-only">
            Use arrow keys to browse images, plus and minus to zoom, and drag to pan.
          </Dialog.Description>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 sm:px-5">
            <p className="max-w-[55vw] truncate font-mono text-[12px] text-ink">
              {image.name}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => changeScale(-0.25)}
                className="rounded px-2 py-1 font-mono text-sm hover:bg-surface"
              >
                −
              </button>
              <span className="min-w-12 text-center font-mono text-[11px] text-muted">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => changeScale(0.25)}
                className="rounded px-2 py-1 font-mono text-sm hover:bg-surface"
              >
                +
              </button>
              <button
                type="button"
                aria-label="Close image viewer"
                onClick={onClose}
                className="ml-2 rounded px-2 py-1 font-mono text-sm hover:bg-surface"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-between gap-2 p-2 sm:p-4">
            <button
              type="button"
              aria-label="Previous image"
              disabled={!canGoPrevious}
              onClick={onPrevious}
              className="rounded-md border border-line px-2 py-3 font-mono text-sm disabled:opacity-40"
            >
              ←
            </button>
            <div
              className="flex h-full min-w-0 flex-1 touch-none items-center justify-center overflow-hidden"
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={stopPan}
              onPointerCancel={stopPan}
              onLostPointerCapture={stopPan}
              style={{ cursor: scale > 1 ? "grab" : "default" }}
            >
              {url ? (
                <img
                  src={url}
                  alt={image.name}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  }}
                />
              ) : (
                <p role={loadError ? "alert" : "status"} className="text-sm text-muted">
                  {loadError ?? "Opening image…"}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Next image"
              disabled={!canGoNext}
              onClick={onNext}
              className="rounded-md border border-line px-2 py-3 font-mono text-sm disabled:opacity-40"
            >
              →
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line px-4 py-3 font-mono text-[10px] text-muted sm:grid-cols-4">
            <div>
              <dt className="uppercase">Dimensions</dt>
              <dd className="text-ink">
                {image.width} × {image.height}
              </dd>
            </div>
            <div>
              <dt className="uppercase">File size</dt>
              <dd className="text-ink">{formatBytes(image.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="uppercase">Format</dt>
              <dd className="text-ink">{image.mimeType}</dd>
            </div>
            <div>
              <dt className="uppercase">Date taken</dt>
              <dd className="text-ink">
                {image.takenAt ? new Date(image.takenAt).toLocaleDateString() : "Unknown"}
              </dd>
            </div>
            {image.camera && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="uppercase">Camera</dt>
                <dd className="text-ink">{image.camera}</dd>
              </div>
            )}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
