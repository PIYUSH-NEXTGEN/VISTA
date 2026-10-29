import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/ui/button";
import { ThemeToggle } from "@/ui/theme-toggle";

describe("ui/Button", () => {
  it("renders its children", () => {
    render(<Button>Import a folder</Button>);
    expect(screen.getByRole("button", { name: "Import a folder" })).toBeInTheDocument();
  });

  it("calls onClick when pressed", () => {
    let clicks = 0;
    render(<Button onClick={() => (clicks += 1)}>Press me</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Press me" }));
    expect(clicks).toBe(1);
  });
});

describe("ui/ThemeToggle", () => {
  it("toggles the dark class on the document element", () => {
    render(<ThemeToggle />);
    const initial = document.documentElement.classList.contains("dark");
    fireEvent.click(
      screen.getByRole("button", { name: initial ? "Light theme" : "Dark theme" }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(!initial);
  });
});
