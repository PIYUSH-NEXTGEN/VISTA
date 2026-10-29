import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (document.documentElement.classList.contains("dark")) return "dark";
  return "light";
}

export function useTheme(): {
  theme: Theme;
  toggleTheme: () => void;
} {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("vista-theme", theme);
    } catch {
      /* localStorage unavailable: theme resets on reload */
    }
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}
