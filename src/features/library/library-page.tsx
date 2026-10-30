import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, MouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  filterByFormat,
  searchImages,
  sortImages,
  type FormatFilterKey,
  type SortDirection,
  type SortKey,
  SORT_OPTIONS,
  FORMAT_FILTER_OPTIONS,
} from "@/core/storage/library-query";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";
import { Button } from "@/ui/button";
import { ImageViewer } from "@/features/library/image-viewer";
import { ImportFeedback } from "@/features/library/import-feedback";
import { StorageMeter } from "@/features/library/storage-meter";
import { ThumbnailCard } from "@/features/library/thumbnail-card";
import { AlbumsPanel } from "@/features/library/albums-panel";
import { useImageImport } from "@/features/library/use-image-import";
import { BackupClient } from "@/core/backup/backup-client";

const libraryStore = new DexieLibraryStore();
const backupClient = new BackupClient();

export function LibraryPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [viewerId, setViewerId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [columnCount, setColumnCount] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("importedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [formatFilter, setFormatFilter] = useState<FormatFilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashImages, setTrashImages] = useState<ImageRecord[]>([]);
  const [backupReminder, setBackupReminder] = useState(
    "A recent backup helps protect photos if browser storage is cleared.",
  );
  const backupInput = useRef<HTMLInputElement>(null);

  const UNDO_WINDOW_MS = 30_000;
  const [pendingUndo, setPendingUndo] = useState<
    | {
        ids: string[];
        images: ImageRecord[];
      }
    | undefined
  >(undefined);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const displayedImages = useMemo(() => {
    const sorted = sortImages(images, sortKey, sortDirection);
    const filtered = filterByFormat(sorted, formatFilter);
    return searchImages(filtered, searchQuery);
  }, [images, sortKey, sortDirection, formatFilter, searchQuery]);

  const fileInput = useRef<HTMLInputElement>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const selectionAnchor = useRef<number | undefined>(undefined);
  const onImported = useCallback((image: ImageRecord) => {
    setImages((current) => [image, ...current]);
  }, []);
  const { importFiles, cancelImport, importProgress, importFailures, notice, setNotice } =
    useImageImport(onImported);

  const refreshImages = useCallback(async () => {
    setLoading(true);
    try {
      setImages(await libraryStore.listImages());
      setLoadError(undefined);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The photo library could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshImages();
  }, [refreshImages]);

  useEffect(() => {
    let active = true;
    void libraryStore.getSetting("lastBackupAt").then((value) => {
      if (!active || typeof value !== "number") return;
      const ageDays = Math.floor((Date.now() - value) / (24 * 60 * 60 * 1000));
      setBackupReminder(
        ageDays >= 30
          ? `Your last backup was ${ageDays} days ago. Export a fresh copy.`
          : `Last backup: ${new Date(value).toLocaleDateString()}.`,
      );
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => backupClient.dispose(), []);

  async function exportBackup() {
    setBackupBusy(true);
    try {
      const archive = await backupClient.exportLibrary();
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vista-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      const timestamp = Date.now();
      await libraryStore.setSetting("lastBackupAt", timestamp);
      setBackupReminder(`Last backup: ${new Date(timestamp).toLocaleDateString()}.`);
      setNotice("Backup downloaded to your device.");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The backup could not be created.",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    setBackupBusy(true);
    try {
      const result = await backupClient.importLibrary(file);
      await refreshImages();
      setSelectedIds(new Set());
      setNotice(
        `Restored ${result.imported} image${result.imported === 1 ? "" : "s"}; skipped ${result.skipped}.`,
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The backup could not be restored.",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  useEffect(() => {
    const element = scrollContainer.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setColumnCount(Math.max(1, Math.floor(width / 180)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [images.length]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const rowCount = Math.ceil(displayedImages.length / columnCount);
  // TanStack Virtual returns a mutable instance that the React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainer.current,
    estimateSize: () => 218,
    overscan: 3,
  });

  const viewerIndex = viewerId
    ? displayedImages.findIndex((image) => image.id === viewerId)
    : -1;
  const viewerImage = viewerIndex >= 0 ? displayedImages[viewerIndex] : undefined;

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) void importFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    void importFiles(event.dataTransfer.files);
  }

  function handleSelect(imageId: string, event: MouseEvent<HTMLButtonElement>) {
    const currentIndex = images.findIndex((image) => image.id === imageId);
    if (event.shiftKey && selectionAnchor.current !== undefined) {
      const start = Math.min(selectionAnchor.current, currentIndex);
      const end = Math.max(selectionAnchor.current, currentIndex);
      setSelectedIds(new Set(images.slice(start, end + 1).map((image) => image.id)));
      return;
    }

    selectionAnchor.current = currentIndex;
    if (event.metaKey || event.ctrlKey) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(imageId)) next.delete(imageId);
        else next.add(imageId);
        return next;
      });
      return;
    }
    setSelectedIds(new Set([imageId]));
  }

  async function removeSelected() {
    if (selectedIds.size === 0) return;
    const toTrash = images.filter((image) => selectedIds.has(image.id));
    if (toTrash.length === 0) return;
    if (
      !window.confirm(
        `Move ${toTrash.length} selected photo${toTrash.length === 1 ? "" : "s"} to Trash? You can restore them for 30 seconds.`,
      )
    )
      return;

    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = undefined;
    }

    try {
      await libraryStore.trashImages(toTrash.map((image) => image.id));
      setImages((current) => current.filter((image) => !selectedIds.has(image.id)));
      setSelectedIds(new Set());
      if (viewerId && toTrash.some((image) => image.id === viewerId)) {
        setViewerId(undefined);
      }

      setPendingUndo({ ids: toTrash.map((image) => image.id), images: toTrash });
      setNotice(
        `${toTrash.length} image${toTrash.length === 1 ? "" : "s"} moved to trash.`,
      );

      undoTimer.current = setTimeout(() => {
        setPendingUndo(undefined);
        undoTimer.current = undefined;
      }, UNDO_WINDOW_MS);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The selected images could not be moved to trash.",
      );
    }
  }

  async function toggleTrash() {
    if (trashOpen) {
      setTrashOpen(false);
      return;
    }
    try {
      setTrashImages(await libraryStore.listTrash());
      setTrashOpen(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Trash could not be opened.");
    }
  }

  async function restoreTrashImage(image: ImageRecord) {
    try {
      await libraryStore.restoreImages([image.id]);
      setTrashImages((items) => items.filter((item) => item.id !== image.id));
      await refreshImages();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The photo could not be restored.",
      );
    }
  }

  async function permanentlyDelete(image: ImageRecord) {
    if (
      !window.confirm(
        `Permanently delete “${image.name}” and its stored edits? This cannot be undone.`,
      )
    )
      return;
    try {
      await libraryStore.purgeImages([image.id]);
      setTrashImages((items) => items.filter((item) => item.id !== image.id));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "The photo could not be permanently deleted.",
      );
    }
  }

  async function emptyTrash() {
    if (
      trashImages.length === 0 ||
      !window.confirm(
        `Permanently delete all ${trashImages.length} photos in Trash? This cannot be undone.`,
      )
    )
      return;
    try {
      await libraryStore.emptyTrash();
      setTrashImages([]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Trash could not be emptied.");
    }
  }

  async function undoTrash() {
    if (!pendingUndo) return;
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = undefined;
    }

    try {
      await libraryStore.restoreImages(pendingUndo.ids);
      await refreshImages();
      setNotice(
        `${pendingUndo.images.length} image${
          pendingUndo.images.length === 1 ? "" : "s"
        } restored.`,
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The images could not be restored.",
      );
    } finally {
      setPendingUndo(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
            Your device · No uploads
          </p>
          <h1 className="mt-2 font-display text-[30px] leading-none text-ink">Library</h1>
          <p className="mt-2 text-[14px] text-muted">
            {images.length} {images.length === 1 ? "image" : "images"} stored in this
            browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportBackup()} disabled={backupBusy}>
            {backupBusy ? "Preparing backup…" : "Export backup"}
          </Button>
          <Button onClick={() => backupInput.current?.click()} disabled={backupBusy}>
            Restore backup
          </Button>
          <input
            ref={backupInput}
            className="sr-only"
            type="file"
            accept=".zip,application/zip"
            aria-label="Choose a VISTA backup to restore"
            onChange={(event) => {
              void importBackup(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          {selectedIds.size === 1 && (
            <Button
              onClick={() => {
                const id = selectedIds.values().next().value;
                if (typeof id === "string") setViewerId(id);
              }}
            >
              Open selected
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button onClick={() => void removeSelected()}>Remove selected</Button>
          )}
          <Button onClick={() => setAlbumsOpen(true)}>Albums</Button>
          <Button onClick={() => void toggleTrash()}>Trash</Button>
          <Button variant="accent" onClick={() => fileInput.current?.click()}>
            Add photos
          </Button>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic,.heif"
            aria-label="Choose photos to add"
            onChange={handleInputChange}
          />
        </div>
      </header>

      {pendingUndo && (
        <section
          aria-live="polite"
          className="mb-6 rounded-lg border border-accent bg-raised p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-accent">Undo</span>
            <p className="text-[13px] text-ink">
              {pendingUndo.images.length} image{pendingUndo.images.length === 1 ? "" : "s"}{" "}
              moved to trash.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void undoTrash()} className="text-[11px] px-3 py-2">
              Undo
            </Button>
            <button
              type="button"
              onClick={() => {
                if (undoTimer.current) clearTimeout(undoTimer.current);
                setPendingUndo(undefined);
              }}
              className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase underline"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      <section
        aria-label="Sort, filter, and search"
        className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"
      >
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
              Sort by
            </span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.currentTarget.value as SortKey)}
              className="rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[11px] text-ink focus:border-accent"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(event.currentTarget.value as SortDirection)
              }
              className="rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[11px] text-ink focus:border-accent"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
              Format
            </span>
            <select
              value={formatFilter}
              onChange={(event) =>
                setFormatFilter(event.currentTarget.value as FormatFilterKey)
              }
              className="rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[11px] text-ink focus:border-accent"
            >
              {FORMAT_FILTER_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="library-search"
            className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase hidden sm:block"
          >
            Search
          </label>
          <input
            id="library-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search name, camera, format, date"
            className="w-[200px] sm:w-[260px] rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink placeholder:text-muted/60 focus:border-accent"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[11px] text-ink focus:border-accent"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {trashOpen && (
        <section
          aria-label="Trash"
          className="mb-6 rounded-lg border border-line bg-raised p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg text-ink">Trash ({trashImages.length})</h2>
            <Button onClick={() => void emptyTrash()} disabled={trashImages.length === 0}>
              Empty trash
            </Button>
          </div>
          {trashImages.length === 0 ? (
            <p className="text-sm text-muted">Trash is empty.</p>
          ) : (
            <ul className="space-y-2">
              {trashImages.map((image) => (
                <li
                  key={image.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2"
                >
                  <span className="truncate text-sm text-ink">{image.name}</span>
                  <div className="flex gap-2">
                    <Button onClick={() => void restoreTrashImage(image)}>Restore</Button>
                    <Button onClick={() => void permanentlyDelete(image)}>
                      Delete permanently
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mb-6">
        <StorageMeter imageCount={images.length} />
        <p className="mt-2 text-xs text-muted" role="status">
          {backupReminder}
        </p>
      </div>

      <section
        aria-label="Import photos"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          const target = event.relatedTarget;
          if (!(target instanceof Node) || !event.currentTarget.contains(target)) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`mb-6 rounded-lg border border-dashed p-6 text-center transition-colors ${
          dragging ? "border-accent bg-raised" : "border-line bg-surface"
        }`}
      >
        <p className="text-[14px] text-ink">
          Drop photos here or use <span className="font-semibold">Add photos</span>.
        </p>
        <p className="mt-1 text-[12px] text-muted">
          JPEG, PNG, and WebP · Up to 50 MB and 100 megapixels per image · HEIC/HEIF and
          AVIF are unsupported; choose JPEG, PNG, or WebP instead
        </p>
      </section>

      <ImportFeedback
        progress={importProgress}
        failures={importFailures}
        notice={notice}
        onCancel={cancelImport}
      />
      {loadError && (
        <div role="alert" className="mb-6 rounded-md border border-line bg-raised p-4">
          <p className="text-[13px] text-accent">{loadError}</p>
          <button
            type="button"
            onClick={() => void refreshImages()}
            className="mt-2 font-mono text-[10px] uppercase underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p role="status" className="py-12 text-center text-sm text-muted">
          Opening your library…
        </p>
      ) : images.length === 0 ? (
        <div className="rounded-lg border border-line bg-raised px-4 py-14 text-center">
          <h2 className="text-[17px] font-semibold text-ink">Your library is empty</h2>
          <p className="mt-2 text-[13px] text-muted">
            Choose a few photos to start building your private library on this device.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-muted">
              {selectedIds.size} selected · Click, Ctrl/⌘-click, or Shift-click
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
              className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase disabled:opacity-40"
            >
              Clear selection
            </button>
          </div>
          <div
            ref={scrollContainer}
            aria-label="Photo thumbnails"
            className="h-[65vh] min-h-64 overflow-auto rounded-lg border border-line bg-surface p-3"
          >
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((row) => {
                const rowImages = displayedImages.slice(
                  row.index * columnCount,
                  (row.index + 1) * columnCount,
                );
                return (
                  <div
                    key={row.key}
                    className="absolute left-0 top-0 grid w-full gap-3"
                    style={{
                      height: `${row.size}px`,
                      transform: `translateY(${row.start}px)`,
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowImages.map((image) => (
                      <ThumbnailCard
                        key={image.id}
                        image={image}
                        store={libraryStore}
                        selected={selectedIds.has(image.id)}
                        onSelect={(event) => handleSelect(image.id, event)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {viewerImage && (
        <ImageViewer
          key={viewerImage.id}
          image={viewerImage}
          store={libraryStore}
          onClose={() => setViewerId(undefined)}
          canGoPrevious={viewerIndex > 0}
          canGoNext={viewerIndex < displayedImages.length - 1}
          onPrevious={() => {
            const previous = displayedImages[viewerIndex - 1];
            if (previous) setViewerId(previous.id);
          }}
          onNext={() => {
            const next = displayedImages[viewerIndex + 1];
            if (next) setViewerId(next.id);
          }}
        />
      )}
      <AlbumsPanel
        store={libraryStore}
        images={images}
        open={albumsOpen}
        onClose={() => setAlbumsOpen(false)}
      />
    </main>
  );
}
