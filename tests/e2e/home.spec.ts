import { expect, test, type Page } from "@playwright/test";
import exifr from "exifr";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

async function createPng(page: Page, width: number, height: number) {
  const pngDataUrl = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create the generated image fixture.");
      context.fillStyle = "#d34d02";
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    },
    { width, height },
  );
  const base64 = pngDataUrl.split(",")[1];
  if (!base64) throw new Error("The generated PNG data URL was invalid.");
  return Buffer.from(base64, "base64");
}

async function createJpegWithExifMake(page: Page) {
  const jpegDataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 6;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create the generated JPEG fixture.");
    context.fillStyle = "#2458aa";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg");
  });
  const base64 = jpegDataUrl.split(",")[1];
  if (!base64) throw new Error("The generated JPEG data URL was invalid.");
  const jpeg = Buffer.from(base64, "base64");
  const exif = Buffer.alloc(37);
  exif.write("Exif\0\0", 0, "binary");
  exif.write("II", 6, "ascii");
  exif.writeUInt16LE(42, 8);
  exif.writeUInt32LE(8, 10);
  exif.writeUInt16LE(1, 14);
  exif.writeUInt16LE(0x010f, 16);
  exif.writeUInt16LE(2, 18);
  exif.writeUInt32LE(5, 20);
  exif.writeUInt32LE(26, 24);
  exif.writeUInt32LE(0, 28);
  exif.write("TEST\0", 32, "ascii");
  const app1 = Buffer.alloc(exif.length + 4);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(exif.length + 2, 2);
  exif.copy(app1, 4);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function createImageFolder(files: { name: string; buffer: Buffer }[]) {
  const directory = await mkdtemp(join(tmpdir(), "vista-e2e-folder-"));
  for (const file of files) await writeFile(join(directory, file.name), file.buffer);
  return directory;
}

async function removeImageFolder(directory: string) {
  const tempRoot = resolve(tmpdir());
  const target = resolve(directory);
  if (!target.startsWith(`${tempRoot}${sep}`)) {
    throw new Error("Refusing to remove a test directory outside the system temp folder.");
  }
  await rm(target, { recursive: true, force: true });
}

test("home shows the offline workbench headline and privacy badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("offline workbench");
  await expect(page.getByText("100% local, photos never leave your browser")).toBeVisible();
});

test("library opens an empty local photo library", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Browser storage" })).toBeVisible();
});

test("imports a local PNG and opens its image viewer", async ({ page }) => {
  await page.addInitScript(() => {
    let protectionGranted = false;
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: async () => ({ usage: 8, quota: 1024 }),
        persisted: async () => protectionGranted,
        persist: async () => {
          protectionGranted = true;
          return true;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();

  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: await createPng(page, 2, 3),
  });

  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  const storageMeter = page.getByRole("region", { name: "Browser storage" });
  await storageMeter.getByRole("button", { name: "Protect storage" }).click();
  await expect(
    storageMeter.getByText(
      "Your browser agreed to protect this library from automatic cleanup.",
    ),
  ).toBeVisible();
  await expect(storageMeter.getByText("Storage protection granted")).toBeVisible();
  await page.getByRole("button", { name: "Select tiny.png" }).click();
  await page.getByRole("button", { name: "Open selected" }).click();
  await expect(page.getByRole("dialog", { name: "Image viewer: tiny.png" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("2 × 3", { exact: true })).toBeVisible();
});

test("shows an explicit unsupported-format message for HEIC files", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  const header = Buffer.alloc(16);
  header.write("ftypheic", 4, "ascii");
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "unsupported.heic",
    mimeType: "image/heic",
    buffer: header,
  });
  await expect(page.getByLabel("Import errors")).toContainText(
    "HEIC/HEIF files are not supported. Choose a JPEG, PNG, or WebP image instead.",
  );
});

test("supports range selection, viewer navigation, and zoom", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles([
    {
      name: "first.png",
      mimeType: "image/png",
      buffer: await createPng(page, 2, 3),
    },
    {
      name: "second.png",
      mimeType: "image/png",
      buffer: await createPng(page, 4, 2),
    },
  ]);
  await expect(page.getByText("2 of 2 selected files processed.")).toBeVisible();

  await page.getByRole("button", { name: "Select first.png" }).click();
  await page
    .getByRole("button", { name: "Select second.png" })
    .click({ modifiers: ["Shift"] });
  await expect(page.getByText(/2 selected ·/)).toBeVisible();
  await page.getByRole("button", { name: "Deselect second.png" }).click();
  await expect(page.getByText(/1 selected ·/)).toBeVisible();
  await page.getByRole("button", { name: "Open selected" }).click();

  await expect(
    page.getByRole("dialog", { name: "Image viewer: second.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  const image = page.getByRole("dialog").getByRole("img", { name: "second.png" });
  const panSurface = image.locator("..");
  const panBounds = await panSurface.boundingBox();
  if (!panBounds) throw new Error("The image viewer pan surface is not visible.");
  await page.mouse.move(
    panBounds.x + panBounds.width / 2,
    panBounds.y + panBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    panBounds.x + panBounds.width / 2 + 40,
    panBounds.y + panBounds.height / 2 + 30,
  );
  await page.mouse.up();
  await expect(image).toHaveAttribute(
    "style",
    /translate\(4\d(?:\.\d+)?px, 3\d(?:\.\d+)?px\) scale\(1.25\)/,
  );
  await page.getByRole("button", { name: "Next image" }).click();
  await expect(page.getByRole("dialog", { name: "Image viewer: first.png" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("2 × 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous image" }).click();
  await expect(
    page.getByRole("dialog", { name: "Image viewer: second.png" }),
  ).toBeVisible();
});

test("serves the app shell after going offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("offline workbench");
});

test("theme toggle switches dark mode", async ({ page }) => {
  await page.goto("/");
  const initialDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  await page
    .getByRole("button", { name: initialDark ? "Light theme" : "Dark theme" })
    .click();
  await expect(
    page.evaluate(() => document.documentElement.classList.contains("dark")),
  ).resolves.toBe(!initialDark);
  await page.reload();
  // The choice persists across reloads and pre-existing boot behavior.
  await expect(
    page.evaluate(() => document.documentElement.classList.contains("dark")),
  ).resolves.toBe(!initialDark);
});

test("restores a deleted photo from a whole-library backup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "backup.png",
    mimeType: "image/png",
    buffer: await createPng(page, 8, 6),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await expect(
    page.getByText("A recent backup helps protect photos if browser storage is cleared."),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  if (!backupPath) throw new Error("The backup did not produce a download file.");
  const backupBytes = await import("node:fs/promises").then(({ readFile }) =>
    readFile(backupPath),
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Select backup.png" }).click();
  await page.getByRole("button", { name: "Remove selected" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "1 image moved to trash." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Empty trash" }).click();
  await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();

  await page.getByLabel("Choose a VISTA backup to restore").setInputFiles({
    name: "vista-backup.zip",
    mimeType: "application/zip",
    buffer: backupBytes,
  });
  await expect(page.getByText("Restored 1 image; skipped 0.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Select backup.png" })).toBeVisible();
});

test("opens the editor and saves a rotated photo as a separate copy", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "edit.png",
    mimeType: "image/png",
    buffer: await createPng(page, 8, 6),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Editor" }).click();
  await expect(page.getByRole("heading", { name: "Editor", exact: true })).toBeVisible();
  if (browserName === "webkit") {
    await expect(page.getByRole("alert")).toHaveText(
      "Editing is not supported by this browser.",
    );
    return;
  }
  await page.getByRole("button", { name: "Rotate 90°" }).click();
  await expect(page.getByRole("img", { name: "edit.png" })).toBeVisible();
  await page.getByRole("button", { name: "Save as new copy" }).click();
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Select Edited edit.png" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select edit.png" })).toBeVisible();
});

test("converts a selected photo as a separate copy", async ({ page, browserName }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "convert.png",
    mimeType: "image/png",
    buffer: await createPng(page, 8, 6),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  await expect(page.getByRole("heading", { name: "Tools", exact: true })).toBeVisible();
  await expect(page.getByText("convert.png", { exact: true })).toBeVisible();
  await page.getByRole("region", { name: "Choose photos" }).getByRole("checkbox").check();
  if (browserName === "webkit") {
    await expect(page.getByRole("alert")).toContainText("worker canvas support");
    return;
  }
  await expect(page.getByText(/Preview: .* at \d+% quality/)).toBeVisible();
  await page.getByRole("button", { name: "Convert batch as copies" }).click();
  await expect(page.getByText("1 of 1 copies saved.")).toBeVisible();
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("button", { name: "Select convert.jpg" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select convert.png" })).toBeVisible();
});

test("converts files chosen from a folder batch source", async ({ page, browserName }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "library-seed.png",
    mimeType: "image/png",
    buffer: await createPng(page, 5, 4),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  const folder = await createImageFolder([
    { name: "folder-photo.png", buffer: await createPng(page, 6, 4) },
  ]);
  try {
    await page.getByRole("button", { name: "Tools" }).click();
    await page.getByLabel("Batch source").selectOption("folder");
    if (browserName === "firefox") {
      const input = page.getByLabel("Choose folder images");
      await input.evaluate((element) => element.removeAttribute("webkitdirectory"));
      await input.setInputFiles({
        name: "folder-photo.png",
        mimeType: "image/png",
        buffer: await createPng(page, 6, 4),
      });
    } else {
      await page.getByLabel("Choose folder images").setInputFiles(folder);
    }
    await expect(page.getByText("folder-photo.png", { exact: true })).toBeVisible();
    if (browserName === "webkit") {
      await expect(page.getByRole("alert")).toContainText("worker canvas support");
      return;
    }
    await page.getByRole("button", { name: "Convert batch as copies" }).click();
    await expect(page.getByText("1 of 1 copies saved.")).toBeVisible();
  } finally {
    await removeImageFolder(folder);
  }
});

test("continues a batch and reports a failed file by name", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "library-seed.png",
    mimeType: "image/png",
    buffer: await createPng(page, 5, 4),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  const folder = await createImageFolder([
    { name: "batch-good.png", buffer: await createPng(page, 5, 4) },
    { name: "batch-broken.png", buffer: Buffer.from("not an image") },
  ]);
  try {
    await page.getByRole("button", { name: "Tools" }).click();
    await page.getByLabel("Batch source").selectOption("folder");
    if (browserName === "firefox") {
      const input = page.getByLabel("Choose folder images");
      await input.evaluate((element) => element.removeAttribute("webkitdirectory"));
      await input.setInputFiles([
        {
          name: "batch-good.png",
          mimeType: "image/png",
          buffer: await createPng(page, 5, 4),
        },
        {
          name: "batch-broken.png",
          mimeType: "image/png",
          buffer: Buffer.from("not an image"),
        },
      ]);
    } else {
      await page.getByLabel("Choose folder images").setInputFiles(folder);
    }
    if (browserName === "webkit") {
      await expect(page.getByRole("alert")).toContainText("worker canvas support");
      return;
    }
    await page.getByRole("button", { name: "Convert batch as copies" }).click();
    await expect(page.getByText("1 of 2 copies saved.")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("batch-broken.png");
  } finally {
    await removeImageFolder(folder);
  }
});

test("converts photos from an album batch source", async ({ page, browserName }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "album-photo.png",
    mimeType: "image/png",
    buffer: await createPng(page, 5, 4),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Albums" }).click();
  await page.getByRole("button", { name: "Create album" }).click();
  await page.getByLabel("Album name").fill("Batch album");
  await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
  const addPhotos = page.getByRole("region", { name: "Add photos to album" });
  await addPhotos.getByRole("checkbox").check();
  await addPhotos.getByRole("button", { name: "Add selected (1)" }).click();
  await expect(page.getByText("1 photo in this album.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByLabel("Batch source").selectOption("album");
  await expect(page.getByLabel("Batch album")).toHaveValue(/.+/);
  await expect(page.getByText("album-photo.png", { exact: true })).toBeVisible();
  if (browserName === "webkit") {
    await expect(page.getByRole("alert")).toContainText("worker canvas support");
    return;
  }
  await page.getByRole("button", { name: "Convert batch as copies" }).click();
  await expect(page.getByText("1 of 1 copies saved.")).toBeVisible();
});

test("uses the Web Share API when the browser accepts files", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        (window as Window & { sharedFileNames?: string[] }).sharedFileNames = files.map(
          (file) => file.name,
        );
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "share-success.png",
    mimeType: "image/png",
    buffer: await createPng(page, 5, 4),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  await page
    .getByRole("region", { name: "Choose photos" })
    .getByRole("button", { name: "Select all" })
    .click();
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByText("Shared 1 file.")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as Window & { sharedFileNames?: string[] }).sharedFileNames,
    ),
  ).toEqual(["share-success.png"]);
});

test("exports multiple selected photos as a ZIP", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  const image = await createPng(page, 5, 4);
  await page.getByLabel("Choose photos to add").setInputFiles([
    { name: "zip-one.png", mimeType: "image/png", buffer: image },
    { name: "zip-two.png", mimeType: "image/png", buffer: image },
  ]);
  await expect(page.getByText("2 of 2 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  const sources = page.getByRole("region", { name: "Choose photos" });
  await sources.getByRole("button", { name: "Select all" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected" }).click();
  const archive = await download;
  expect(archive.suggestedFilename()).toBe("vista-export.zip");
  await expect(page.getByText("Exported 2 files.")).toBeVisible();
});

test("writes selected photos to a folder when the picker API is available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = window as Window & { writtenFileNames: string[] };
    target.writtenFileNames = [];
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => ({
        getFileHandle: async (name: string) => ({
          createWritable: async () => ({
            write: async () => target.writtenFileNames.push(name),
            close: async () => undefined,
          }),
        }),
      }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "folder-export.png",
    mimeType: "image/png",
    buffer: await createPng(page, 5, 4),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  await page
    .getByRole("region", { name: "Choose photos" })
    .getByRole("button", { name: "Select all" })
    .click();
  await page.getByRole("button", { name: "Write to folder" }).click();
  await expect(page.getByText("Wrote 1 of 1 files to the selected folder.")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as Window & { writtenFileNames: string[] }).writtenFileNames,
    ),
  ).toEqual(["folder-export.png"]);
});

test("re-encodes an export when metadata removal is selected", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  const originalWithExif = await createJpegWithExifMake(page);
  expect((await exifr.parse(originalWithExif))?.Make).toBe("TEST");
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "metadata-export.jpg",
    mimeType: "image/jpeg",
    buffer: originalWithExif,
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  const options = page.getByRole("region", { name: "Convert and compress" });
  await options
    .getByRole("checkbox", {
      name: /Re-encode exports to remove metadata, including location/,
    })
    .check();
  await page
    .getByRole("region", { name: "Choose photos" })
    .getByRole("button", { name: "Select all" })
    .click();
  if (browserName === "webkit") {
    await expect(page.getByRole("alert")).toContainText("worker canvas support");
    return;
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected" }).click();
  const result = await download;
  expect(result.suggestedFilename()).toBe("metadata-export.jpg");
  const outputStream = await result.createReadStream();
  const output: Buffer[] = [];
  for await (const chunk of outputStream) output.push(Buffer.from(chunk));
  const metadata = await exifr.parse(Buffer.concat(output));
  expect(metadata?.Make).toBeUndefined();
});

test("falls back to a download when file sharing is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "share-fallback.png",
    mimeType: "image/png",
    buffer: await createPng(page, 5, 4),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  await page
    .getByRole("region", { name: "Choose photos" })
    .getByRole("button", { name: "Select all" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share" }).click();
  expect((await download).suggestedFilename()).toBe("share-fallback.png");
  await expect(page.getByText(/Exported 1 file\./)).toBeVisible();
});

test("analyzes duplicate photos and caches health scores", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  const samePixels = await createPng(page, 8, 6);
  await page.getByLabel("Choose photos to add").setInputFiles([
    { name: "duplicate-a.png", mimeType: "image/png", buffer: samePixels },
    { name: "duplicate-b.png", mimeType: "image/png", buffer: samePixels },
  ]);
  await expect(page.getByText("2 of 2 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Health" }).click();
  await expect(page.getByText(/Exact duplicates \(1 groups · 2 photos\)/)).toBeVisible();
  await page.getByRole("button", { name: "Analyze photos" }).click();
  if (browserName === "webkit") {
    await expect(page.getByRole("alert")).toContainText("worker canvas support");
    return;
  }
  await expect(page.getByText("Analyzed 2 photos.")).toBeVisible();
  await expect(page.getByText(/Similar photos \(1 groups · 2 photos\)/)).toBeVisible();
  await expect(page.getByText(/Quality flags \(2\)/)).toBeVisible();
  await page.getByRole("button", { name: "Analyze photos" }).click();
  await expect(page.getByText("All photos already have cached analysis.")).toBeVisible();
});

test("creates and downloads a profile image and contact sheet", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await page.getByLabel("Choose photos to add").setInputFiles({
    name: "create.png",
    mimeType: "image/png",
    buffer: await createPng(page, 8, 6),
  });
  await expect(page.getByText("1 of 1 selected files processed.")).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("create.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select up to 100" }).click();
  await page
    .getByRole("button", { name: "Create profile image from first selected photo" })
    .click();
  if (browserName === "webkit") {
    await expect(page.getByRole("alert")).toContainText("worker canvas support");
    return;
  }
  await expect(page.getByRole("img", { name: "Profile image preview" })).toBeVisible();
  const profileDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download image" }).click();
  expect((await profileDownload).suggestedFilename()).toBe("vista-profile.png");

  await page.getByRole("button", { name: "Create collage / contact sheet" }).click();
  await expect(page.getByRole("img", { name: "Contact sheet preview" })).toBeVisible();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF contact sheet" }).click();
  expect((await pdfDownload).suggestedFilename()).toBe("vista-contact-sheet.pdf");
});
