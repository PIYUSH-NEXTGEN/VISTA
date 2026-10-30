import { expect, test, type Page } from "@playwright/test";

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
