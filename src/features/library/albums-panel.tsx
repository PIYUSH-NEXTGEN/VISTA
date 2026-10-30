import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultRangeExtractor,
  useVirtualizer,
  type VirtualItem,
} from "@tanstack/react-virtual";
import { AlbumIcon } from "@/ui/icons";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import type { AlbumRecord, ImageRecord } from "@/core/storage/models";
import {
  AlbumError,
  type AlbumSummary,
  type LibraryStore,
} from "@/core/storage/library-store";
import { ThumbnailCard } from "@/features/library/thumbnail-card";

interface AlbumsPanelProps {
  store: LibraryStore;
  images: ImageRecord[];
  open: boolean;
  onClose: () => void;
}

export function AlbumsPanel({ store, images, open, onClose }: AlbumsPanelProps) {
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [albumsLoaded, setAlbumsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [currentAlbum, setCurrentAlbum] = useState<AlbumRecord | undefined>(undefined);
  const [albumImages, setAlbumImages] = useState<ImageRecord[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set());
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(() => new Set());
  const [creating, setCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [renaming, setRenaming] = useState<{ albumId: string; name: string } | undefined>(
    undefined,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const albumImageIds = useMemo(
    () => new Set(albumImages.map((image) => image.id)),
    [albumImages],
  );
  const availableImages = useMemo(
    () => images.filter((image) => !albumImageIds.has(image.id)),
    [albumImageIds, images],
  );

  const loadAlbums = useCallback(async () => {
    try {
      setAlbums(await store.listAlbums());
      setAlbumsLoaded(true);
    } catch (caught) {
      setError(errorMessage(caught, "Albums could not be loaded."));
    }
  }, [store]);

  const loadAlbumImages = useCallback(
    async (albumId: string): Promise<boolean> => {
      setLoading(true);
      try {
        setAlbumImages(await store.listAlbumImages(albumId));
        setSelectedImageIds(new Set());
        setSelectedToAdd(new Set());
        return true;
      } catch (caught) {
        setError(errorMessage(caught, "Photos in this album could not be loaded."));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [store],
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    void store
      .listAlbums()
      .then((nextAlbums) => {
        if (!active) return;
        setAlbums(nextAlbums);
        setAlbumsLoaded(true);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(errorMessage(caught, "Albums could not be loaded."));
        setAlbumsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [open, store]);

  function closePanel() {
    setView("list");
    setCurrentAlbum(undefined);
    setAlbumImages([]);
    setSelectedImageIds(new Set());
    setSelectedToAdd(new Set());
    setAlbums([]);
    setAlbumsLoaded(false);
    setLoading(false);
    setError(undefined);
    onClose();
  }

  async function createAlbum() {
    const name = newAlbumName.trim();
    if (!name) return;
    setSaving(true);
    setError(undefined);
    try {
      const album = await store.createAlbum(name);
      setNewAlbumName("");
      setCreating(false);
      setCurrentAlbum(album);
      await loadAlbums();
      if (await loadAlbumImages(album.id)) setView("detail");
    } catch (caught) {
      setError(errorMessage(caught, "The album could not be created."));
    } finally {
      setSaving(false);
    }
  }

  async function renameAlbum() {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    setSaving(true);
    setError(undefined);
    try {
      await store.renameAlbum(renaming.albumId, name);
      setAlbums((current) =>
        current.map((summary) =>
          summary.album.id === renaming.albumId
            ? { ...summary, album: { ...summary.album, name } }
            : summary,
        ),
      );
      setCurrentAlbum((current) =>
        current?.id === renaming.albumId ? { ...current, name } : current,
      );
      setRenaming(undefined);
    } catch (caught) {
      setError(errorMessage(caught, "The album could not be renamed."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAlbum() {
    if (deleteConfirm === undefined) return;
    const albumId = deleteConfirm;
    setSaving(true);
    setError(undefined);
    try {
      await store.deleteAlbum(albumId);
      setAlbums((current) => current.filter((summary) => summary.album.id !== albumId));
      setDeleteConfirm(undefined);
      if (currentAlbum?.id === albumId) {
        setView("list");
        setCurrentAlbum(undefined);
        setAlbumImages([]);
      }
    } catch (caught) {
      setError(errorMessage(caught, "The album could not be deleted."));
    } finally {
      setSaving(false);
    }
  }

  async function openAlbum(summary: AlbumSummary) {
    setError(undefined);
    if (!(await loadAlbumImages(summary.album.id))) return;
    setCurrentAlbum(summary.album);
    setView("detail");
  }

  async function addSelectedToAlbum() {
    if (!currentAlbum || selectedToAdd.size === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await store.addImagesToAlbum(currentAlbum.id, [...selectedToAdd]);
      setSelectedToAdd(new Set());
      await loadAlbumImages(currentAlbum.id);
      await loadAlbums();
    } catch (caught) {
      setError(errorMessage(caught, "The selected photos could not be added."));
    } finally {
      setSaving(false);
    }
  }

  async function removeSelectedFromAlbum() {
    if (!currentAlbum || selectedImageIds.size === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await store.removeImagesFromAlbum(currentAlbum.id, [...selectedImageIds]);
      await loadAlbumImages(currentAlbum.id);
      await loadAlbums();
    } catch (caught) {
      setError(errorMessage(caught, "The selected photos could not be removed."));
    } finally {
      setSaving(false);
    }
  }

  async function moveImage(imageId: string, delta: number) {
    if (!currentAlbum) return;
    const index = albumImages.findIndex((image) => image.id === imageId);
    const target = Math.max(0, Math.min(index + delta, albumImages.length - 1));
    if (index < 0 || target === index) return;
    setSaving(true);
    setError(undefined);
    try {
      await store.reorderAlbumItem(currentAlbum.id, imageId, target);
      await loadAlbumImages(currentAlbum.id);
    } catch (caught) {
      setError(errorMessage(caught, "The photo could not be reordered."));
    } finally {
      setSaving(false);
    }
  }

  async function setAlbumCover(imageId: string) {
    if (!currentAlbum) return;
    setSaving(true);
    setError(undefined);
    try {
      await store.setAlbumCover(currentAlbum.id, imageId);
      setCurrentAlbum((current) =>
        current ? { ...current, coverImageId: imageId } : current,
      );
      setAlbums((current) =>
        current.map((summary) =>
          summary.album.id === currentAlbum.id
            ? { ...summary, album: { ...summary.album, coverImageId: imageId } }
            : summary,
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught, "The cover photo could not be changed."));
    } finally {
      setSaving(false);
    }
  }

  function toggleSelection(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!open) return null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closePanel();
        }}
        title={view === "list" ? "Albums" : (currentAlbum?.name ?? "Album")}
        description={
          view === "list"
            ? "Create albums to group photos. Deleting an album does not delete its photos."
            : undefined
        }
      >
        {error && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3"
          >
            <p className="text-[13px] text-accent">{error}</p>
            <Button
              className="px-3 py-2 text-[10px]"
              onClick={() => {
                setError(undefined);
                if (view === "detail" && currentAlbum) {
                  void loadAlbumImages(currentAlbum.id);
                } else {
                  setAlbumsLoaded(false);
                  void loadAlbums();
                }
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {view === "list" || !currentAlbum ? (
          <AlbumListView
            albums={albums}
            loading={loading || !albumsLoaded}
            onOpenAlbum={(summary) => void openAlbum(summary)}
            onCreateAlbum={() => {
              setError(undefined);
              setCreating(true);
            }}
            onRenameAlbum={(summary) =>
              setRenaming({
                albumId: summary.album.id,
                name: summary.album.name,
              })
            }
            onDeleteAlbum={setDeleteConfirm}
          />
        ) : (
          <AlbumDetailView
            album={currentAlbum}
            images={albumImages}
            availableImages={availableImages}
            selectedImageIds={selectedImageIds}
            selectedToAdd={selectedToAdd}
            loading={loading}
            saving={saving}
            store={store}
            onBack={() => {
              setView("list");
              setCurrentAlbum(undefined);
            }}
            onSelectImage={(id) => toggleSelection(setSelectedImageIds, id)}
            onSelectImageToAdd={(id) => toggleSelection(setSelectedToAdd, id)}
            onAdd={addSelectedToAlbum}
            onRemove={removeSelectedFromAlbum}
            onMove={moveImage}
            onSetCover={setAlbumCover}
            onRename={() =>
              setRenaming({ albumId: currentAlbum.id, name: currentAlbum.name })
            }
            onDelete={setDeleteConfirm}
          />
        )}
      </Dialog>

      <AlbumCreateDialog
        open={creating}
        name={newAlbumName}
        saving={saving}
        onNameChange={setNewAlbumName}
        onSubmit={createAlbum}
        onCancel={() => setCreating(false)}
      />
      {renaming && (
        <AlbumRenameDialog
          open
          name={renaming.name}
          saving={saving}
          onNameChange={(name) => setRenaming((current) => current && { ...current, name })}
          onSubmit={renameAlbum}
          onCancel={() => setRenaming(undefined)}
        />
      )}
      {deleteConfirm !== undefined && (
        <AlbumDeleteDialog
          open
          saving={saving}
          onConfirm={deleteAlbum}
          onCancel={() => setDeleteConfirm(undefined)}
        />
      )}
    </>
  );
}

interface AlbumListViewProps {
  albums: AlbumSummary[];
  loading: boolean;
  onOpenAlbum: (album: AlbumSummary) => void;
  onCreateAlbum: () => void;
  onRenameAlbum: (album: AlbumSummary) => void;
  onDeleteAlbum: (albumId: string) => void;
}

function AlbumListView({
  albums,
  loading,
  onOpenAlbum,
  onCreateAlbum,
  onRenameAlbum,
  onDeleteAlbum,
}: AlbumListViewProps) {
  const albumListRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns a mutable instance that the React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const albumVirtualizer = useVirtualizer({
    count: albums.length,
    getScrollElement: () => albumListRef.current,
    initialRect: { width: 448, height: 320 },
    rangeExtractor: (range) => {
      const visibleRows = defaultRangeExtractor(range);
      return visibleRows.length === 0 && range.count > 0 ? [0] : visibleRows;
    },
    estimateSize: () => 76,
    overscan: 5,
  });
  const albumRows = rowsOrInitial(albumVirtualizer.getVirtualItems(), albums.length, 76);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[14px] font-semibold text-ink">Your albums</h2>
        <Button variant="accent" onClick={onCreateAlbum}>
          Create album
        </Button>
      </div>
      {loading && (
        <p role="status" className="text-[12px] text-muted">
          Loading albums…
        </p>
      )}
      {!loading && albums.length === 0 && (
        <p className="text-[12px] text-muted">
          No albums yet. Create one to group your photos.
        </p>
      )}
      {albums.length > 0 && (
        <div
          ref={albumListRef}
          role="list"
          className="max-h-80 overflow-y-auto rounded-lg border border-line bg-surface"
        >
          <div
            style={{
              height: `${albumVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {albumRows.map((row) => {
              const summary = albums[row.index];
              if (!summary) return null;
              return (
                <div
                  key={summary.album.id}
                  role="listitem"
                  className="absolute left-0 top-0 flex w-full items-center justify-between gap-3 border-b border-line px-3 py-3 text-left"
                  style={{
                    height: `${row.size}px`,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AlbumIcon className="h-5 w-5 shrink-0 text-muted" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-[12px] font-medium text-ink">
                        {summary.album.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {summary.imageCount} {summary.imageCount === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SmallButton
                      label={`Open ${summary.album.name}`}
                      onClick={() => onOpenAlbum(summary)}
                    >
                      Open
                    </SmallButton>
                    <SmallButton
                      label={`Rename ${summary.album.name}`}
                      onClick={() => onRenameAlbum(summary)}
                    >
                      Rename
                    </SmallButton>
                    <SmallButton
                      label={`Delete ${summary.album.name}`}
                      onClick={() => onDeleteAlbum(summary.album.id)}
                      destructive
                    >
                      Delete
                    </SmallButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface AlbumDetailViewProps {
  album: AlbumRecord;
  images: ImageRecord[];
  availableImages: ImageRecord[];
  selectedImageIds: Set<string>;
  selectedToAdd: Set<string>;
  loading: boolean;
  saving: boolean;
  store: LibraryStore;
  onBack: () => void;
  onSelectImage: (id: string) => void;
  onSelectImageToAdd: (id: string) => void;
  onAdd: () => void;
  onRemove: () => void;
  onMove: (imageId: string, delta: number) => void;
  onSetCover: (imageId: string) => void;
  onRename: () => void;
  onDelete: (albumId: string) => void;
}

function AlbumDetailView({
  album,
  images,
  availableImages,
  selectedImageIds,
  selectedToAdd,
  loading,
  saving,
  store,
  onBack,
  onSelectImage,
  onSelectImageToAdd,
  onAdd,
  onRemove,
  onMove,
  onSetCover,
  onRename,
  onDelete,
}: AlbumDetailViewProps) {
  const availableImagesRef = useRef<HTMLDivElement>(null);
  const albumImagesRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns a mutable instance that the React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const availableVirtualizer = useVirtualizer({
    count: availableImages.length,
    getScrollElement: () => availableImagesRef.current,
    initialRect: { width: 320, height: 160 },
    rangeExtractor: (range) => {
      const visibleRows = defaultRangeExtractor(range);
      return visibleRows.length === 0 && range.count > 0 ? [0] : visibleRows;
    },
    estimateSize: () => 32,
    overscan: 5,
  });
  const imageRowCount = Math.ceil(images.length / 2);
  const imageVirtualizer = useVirtualizer({
    count: imageRowCount,
    getScrollElement: () => albumImagesRef.current,
    initialRect: { width: 448, height: 340 },
    rangeExtractor: (range) => {
      const visibleRows = defaultRangeExtractor(range);
      return visibleRows.length === 0 && range.count > 0 ? [0] : visibleRows;
    },
    estimateSize: () => 340,
    overscan: 3,
  });
  const availableRows = rowsOrInitial(
    availableVirtualizer.getVirtualItems(),
    availableImages.length,
    32,
  );
  const imageRows = rowsOrInitial(imageVirtualizer.getVirtualItems(), imageRowCount, 340);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={onBack} className="px-3 py-2 text-[10px]">
          Back to albums
        </Button>
        <div className="flex items-center gap-1.5">
          <SmallButton label="Rename album" onClick={onRename}>
            Rename
          </SmallButton>
          <SmallButton label="Delete album" onClick={() => onDelete(album.id)} destructive>
            Delete
          </SmallButton>
        </div>
      </div>
      <p className="font-mono text-[11px] text-muted">
        {images.length} {images.length === 1 ? "photo" : "photos"} in this album. Removing
        photos here keeps them in your library.
      </p>

      <section
        aria-label="Add photos to album"
        className="space-y-2 rounded-lg border border-line p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-[11px] font-semibold text-ink">
            Add photos from your library
          </h3>
          <Button
            variant="accent"
            className="px-3 py-2 text-[10px]"
            disabled={saving || selectedToAdd.size === 0}
            onClick={onAdd}
          >
            Add selected ({selectedToAdd.size})
          </Button>
        </div>
        {availableImages.length === 0 ? (
          <p className="text-[12px] text-muted">
            Every photo in your library is already in this album.
          </p>
        ) : (
          <div
            ref={availableImagesRef}
            className="max-h-40 overflow-y-auto"
            aria-label="Available library photos"
          >
            <div
              style={{
                height: `${availableVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {availableRows.map((row) => {
                const image = availableImages[row.index];
                if (!image) return null;
                return (
                  <label
                    key={image.id}
                    className="absolute left-0 top-0 flex w-full items-center gap-2 rounded px-2 py-1 text-[12px] text-ink hover:bg-surface"
                    style={{
                      height: `${row.size}px`,
                      transform: `translateY(${row.start}px)`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedToAdd.has(image.id)}
                      onChange={() => onSelectImageToAdd(image.id)}
                    />
                    <span className="truncate">{image.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] font-semibold text-ink">Album photos</h3>
        {selectedImageIds.size > 0 && (
          <Button className="px-3 py-2 text-[10px]" disabled={saving} onClick={onRemove}>
            Remove selected from album ({selectedImageIds.size})
          </Button>
        )}
      </div>
      {loading && (
        <p role="status" className="text-[12px] text-muted">
          Loading photos…
        </p>
      )}
      {!loading && images.length === 0 ? (
        <p className="text-[12px] text-muted">
          This album is empty. Select photos above to add them.
        </p>
      ) : (
        <div
          ref={albumImagesRef}
          className="max-h-[50vh] overflow-y-auto"
          aria-label="Photos in this album"
        >
          <div
            style={{
              height: `${imageVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {imageRows.map((row) => (
              <div
                key={row.key}
                className="absolute left-0 top-0 grid w-full grid-cols-2 gap-3"
                style={{
                  height: `${row.size}px`,
                  transform: `translateY(${row.start}px)`,
                }}
              >
                {images.slice(row.index * 2, row.index * 2 + 2).map((image, column) => {
                  const index = row.index * 2 + column;
                  return (
                    <div
                      key={image.id}
                      className="min-w-0 rounded-lg border border-line p-2"
                    >
                      <div className="relative">
                        <ThumbnailCard
                          image={image}
                          store={store}
                          selected={selectedImageIds.has(image.id)}
                          onSelect={() => onSelectImage(image.id)}
                        />
                        {album.coverImageId === image.id && (
                          <span className="pointer-events-none absolute left-2 top-2 rounded bg-accent px-2 py-1 font-mono text-[9px] text-accent-ink">
                            Cover photo
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between gap-1">
                        <SmallButton
                          label={`Move ${image.name} up`}
                          disabled={saving || index === 0}
                          onClick={() => onMove(image.id, -1)}
                        >
                          Move up
                        </SmallButton>
                        <SmallButton
                          label={`Move ${image.name} down`}
                          disabled={saving || index === images.length - 1}
                          onClick={() => onMove(image.id, 1)}
                        >
                          Move down
                        </SmallButton>
                        {album.coverImageId !== image.id && (
                          <SmallButton
                            label={`Set ${image.name} as cover`}
                            disabled={saving}
                            onClick={() => onSetCover(image.id)}
                          >
                            Set cover
                          </SmallButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SmallButtonProps {
  label: string;
  children: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function SmallButton({
  label,
  children,
  onClick,
  disabled = false,
  destructive = false,
}: SmallButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border border-line bg-surface px-2 py-1 font-mono text-[10px] hover:bg-accent-hover disabled:opacity-40 ${
        destructive ? "text-accent" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

interface AlbumFormDialogProps {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

function AlbumFormDialog({
  open,
  title,
  description,
  submitLabel,
  saving,
  onSubmit,
  onCancel,
  children,
}: AlbumFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      title={title}
      description={description}
    >
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface AlbumCreateDialogProps {
  open: boolean;
  name: string;
  saving: boolean;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function AlbumCreateDialog({
  open,
  name,
  saving,
  onNameChange,
  onSubmit,
  onCancel,
}: AlbumCreateDialogProps) {
  return (
    <AlbumFormDialog
      open={open}
      title="Create album"
      description="Give the new album a name."
      submitLabel="Create"
      saving={saving}
      onSubmit={onSubmit}
      onCancel={onCancel}
    >
      <label className="block space-y-1 text-[12px] text-muted">
        Album name
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
          maxLength={120}
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink focus:border-accent"
        />
      </label>
    </AlbumFormDialog>
  );
}

interface AlbumRenameDialogProps {
  open: boolean;
  name: string;
  saving: boolean;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function AlbumRenameDialog({
  open,
  name,
  saving,
  onNameChange,
  onSubmit,
  onCancel,
}: AlbumRenameDialogProps) {
  return (
    <AlbumFormDialog
      open={open}
      title="Rename album"
      description="Enter a new name for the album."
      submitLabel="Rename"
      saving={saving}
      onSubmit={onSubmit}
      onCancel={onCancel}
    >
      <label className="block space-y-1 text-[12px] text-muted">
        Album name
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
          maxLength={120}
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink focus:border-accent"
        />
      </label>
    </AlbumFormDialog>
  );
}

interface AlbumDeleteDialogProps {
  open: boolean;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function AlbumDeleteDialog({ open, saving, onConfirm, onCancel }: AlbumDeleteDialogProps) {
  return (
    <AlbumFormDialog
      open={open}
      title="Delete album"
      description="Remove this album and its organization only. Photos in your library will stay safe."
      submitLabel="Delete album"
      saving={saving}
      onSubmit={onConfirm}
      onCancel={onCancel}
    >
      <p className="text-[12px] text-muted">
        You can still find the photos in your library after deleting this album.
      </p>
    </AlbumFormDialog>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AlbumError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function rowsOrInitial(
  visibleRows: VirtualItem[],
  totalCount: number,
  estimatedSize: number,
): VirtualItem[] {
  if (visibleRows.length > 0 || totalCount === 0) return visibleRows;
  return Array.from({ length: Math.min(totalCount, 5) }, (_, index) => ({
    key: index,
    index,
    start: index * estimatedSize,
    end: (index + 1) * estimatedSize,
    size: estimatedSize,
    lane: 0,
  }));
}
