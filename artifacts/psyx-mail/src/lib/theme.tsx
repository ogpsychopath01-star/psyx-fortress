import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "red-black" | "light-blue" | "pink" | "white" | "purple" | "green";

export interface ThemeDefinition {
  id: Theme;
  label: string;
  swatch: string;
  textColor: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: "red-black", label: "Crimson", swatch: "#dc2626", textColor: "#fff" },
  { id: "light-blue", label: "Cyan", swatch: "#06b6d4", textColor: "#0a1a1e" },
  { id: "pink", label: "Pink", swatch: "#ec4899", textColor: "#1a0010" },
  { id: "white", label: "White", swatch: "#f5f5f5", textColor: "#111" },
  { id: "purple", label: "Purple", swatch: "#8b5cf6", textColor: "#fff" },
  { id: "green", label: "Matrix", swatch: "#22c55e", textColor: "#021a06" },
];

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "red-black",
  setTheme: () => {},
});

const STORAGE_KEY = "psyx_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return saved && THEMES.some(t => t.id === saved) ? saved : "red-black";
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme data attributes
    THEMES.forEach(t => root.removeAttribute(`data-theme-${t.id}`));
    root.setAttribute("data-theme", theme);
    // White theme uses light mode class, others use dark
    if (theme === "white") {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
