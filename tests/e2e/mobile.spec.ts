import { expect, test } from "@playwright/test";

test("mobile layout keeps workspace navigation and library usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const compactNavigation = page.getByRole("navigation", { name: /Workspaces/ });
  await expect(compactNavigation).toBeVisible();
  await compactNavigation.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Browser storage" })).toBeVisible();

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Mobile viewport was not configured.");
  const overflow = await page.evaluate(() => ({
    width: document.body.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).replaceAll(" ", ".")}` : ""}(${element.clientWidth}/${element.scrollWidth})`,
      )
      .slice(0, 8),
  }));
  const pageWidth = overflow.width;
  expect(
    pageWidth,
    `Horizontal overflow: ${overflow.elements.join(", ")}`,
  ).toBeLessThanOrEqual(viewport.width);
});

test("mobile workspace controls remain keyboard reachable", async ({ page }) => {
  await page.goto("/");
  const libraryButton = page
    .getByRole("navigation", { name: /Workspaces/ })
    .getByRole("button", { name: "Library" });
  await libraryButton.focus();
  await expect(libraryButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
});
