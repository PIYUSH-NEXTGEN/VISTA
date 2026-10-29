import { useTheme } from "@/app/use-theme";
import { SunIcon, MoonIcon } from "@/ui/icons";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-raised p-0.5 sm:gap-1 sm:p-1"
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={theme === "light"}
        aria-label="Light theme"
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7 ${
          theme === "light" ? "bg-ink text-bg" : "text-muted hover:text-ink"
        }`}
      >
        <SunIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={theme === "dark"}
        aria-label="Dark theme"
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7 ${
          theme === "dark" ? "bg-ink text-bg" : "text-muted hover:text-ink"
        }`}
      >
        <MoonIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </button>
    </div>
  );
}
