import { test, expect } from "@playwright/test";

test("home shows the offline workbench headline and privacy badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("offline workbench");
  await expect(page.getByText("100% local, photos never leave your browser")).toBeVisible();
});

test("workspace nav switches to a phase placeholder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(page.getByText(/ships in Phase 1/)).toBeVisible();
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
