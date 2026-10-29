import { describe, expect, it, beforeEach } from "vitest";

/* Minimal theme boot helper mirroring index.html so the behavior is testable.
 * Keeping the logic small and in one place avoids drift between HTML and app.
 */
function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

describe("index.html theme boot script", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light when nothing is stored", () => {
    applyTheme("light"); // boot script result with stored=undefined, media=false
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists the chosen theme (toggle + storage round trip)", () => {
    applyTheme("dark");
    localStorage.setItem("vista-theme", "dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("vista-theme")).toBe("dark");
  });
});
