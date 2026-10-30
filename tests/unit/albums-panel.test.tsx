import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ImageRecord } from "@/core/storage/models";
import type { LibraryStore } from "@/core/storage/library-store";
import { AlbumsPanel } from "@/features/library/albums-panel";

const image: ImageRecord = {
  id: "image-1",
  name: "photo.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 120,
  width: 20,
  height: 10,
  importedAt: 1,
  contentHash: "hash",
};

function createStore() {
  let album:
    { id: string; name: string; createdAt: number; coverImageId?: string } | undefined;
  let members: string[] = [];

  const store: LibraryStore = {
    addImage: vi.fn(async () => {}),
    listImages: vi.fn(async () => [image]),
    getImage: vi.fn(async () => image),
    getOriginal: vi.fn(async () => undefined),
    getThumbnail: vi.fn(async () => undefined),
    deleteImage: vi.fn(async () => {}),
    trashImages: vi.fn(async () => {}),
    restoreImages: vi.fn(async () => {}),
    listTrash: vi.fn(async () => []),
    purgeImages: vi.fn(async () => {}),
    emptyTrash: vi.fn(async () => 0),
    getSetting: vi.fn(async () => undefined),
    setSetting: vi.fn(async () => {}),
    listAlbums: vi.fn(async () =>
      album ? [{ album: { ...album }, imageCount: members.length }] : [],
    ),
    listAlbumImages: vi.fn(async () => (members.includes(image.id) ? [image] : [])),
    createAlbum: vi.fn(async (name: string) => {
      album = { id: "album-1", name, createdAt: 1 };
      return { ...album };
    }),
    renameAlbum: vi.fn(async (albumId: string, name: string) => {
      if (album?.id === albumId) album = { ...album, name };
    }),
    deleteAlbum: vi.fn(async () => {
      album = undefined;
      members = [];
    }),
    addImagesToAlbum: vi.fn(async (_albumId: string, ids: string[]) => {
      members = [...new Set([...members, ...ids])];
    }),
    removeImagesFromAlbum: vi.fn(async (_albumId: string, ids: string[]) => {
      members = members.filter((id) => !ids.includes(id));
    }),
    reorderAlbumItem: vi.fn(async () => {}),
    setAlbumCover: vi.fn(async (albumId: string, imageId: string) => {
      if (album?.id === albumId) album = { ...album, coverImageId: imageId };
    }),
  };
  return store;
}

describe("AlbumsPanel", () => {
  it("creates an album and adds selected library photos", async () => {
    const store = createStore();
    render(<AlbumsPanel store={store} images={[image]} open onClose={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Albums" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create album" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Album name" }), {
      target: { value: "Weekend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(store.createAlbum).toHaveBeenCalledWith("Weekend"));
    expect(await screen.findByRole("heading", { name: "Album photos" })).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "photo.jpg" }));
    fireEvent.click(screen.getByRole("button", { name: "Add selected (1)" }));

    await waitFor(() =>
      expect(store.addImagesToAlbum).toHaveBeenCalledWith("album-1", ["image-1"]),
    );
    expect(await screen.findByRole("button", { name: "Select photo.jpg" })).toBeVisible();
  });

  it("explains that deleting an album keeps its photos", async () => {
    const store = createStore();
    render(<AlbumsPanel store={store} images={[image]} open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Create album" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Album name" }), {
      target: { value: "Weekend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    const deleteButton = await screen.findByRole("button", { name: "Delete album" });
    fireEvent.click(deleteButton);

    expect(await screen.findByText(/Photos in your library will stay safe/)).toBeVisible();
    const confirmation = screen.getByRole("dialog", { name: "Delete album" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Delete album" }));
    await waitFor(() => expect(store.deleteAlbum).toHaveBeenCalledWith("album-1"));
  });
});
