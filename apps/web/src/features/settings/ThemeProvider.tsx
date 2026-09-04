import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getSettings, updateAppearance } from "@/features/settings/api";
import {
  ThemeContext,
  type FontSizePreference,
  type ThemePreference,
} from "./theme-context";

const THEME_KEY = "bakbak.theme";
const FONT_SIZE_KEY = "bakbak.fontSize";

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function prefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(theme: ThemePreference): "light" | "dark" {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolve(theme) === "dark");
}

function applyFontSize(size: FontSizePreference) {
  document.documentElement.dataset.fontSize = size;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    readStored<ThemePreference>(THEME_KEY, "light"),
  );
  const [fontSize, setFontSizeState] = useState<FontSizePreference>(() =>
    readStored<FontSizePreference>(FONT_SIZE_KEY, "small"),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolve(theme),
  );

  // Keep the DOM in sync with the current preference.
  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(resolve(theme));
  }, [theme]);

  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  // React to OS theme changes while on "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
      setResolvedTheme(resolve("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Load the persisted preference from the API once signed in.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getSettings()
      .then((res) => {
        if (cancelled) return;
        setThemeState(res.appearance.theme);
        setFontSizeState(res.appearance.fontSize);
        persist(THEME_KEY, res.appearance.theme);
        persist(FONT_SIZE_KEY, res.appearance.fontSize);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const save = useCallback(
    (next: { theme: ThemePreference; fontSize: FontSizePreference }) => {
      if (!isAuthenticated) return;
      void updateAppearance(next).catch(() => {});
    },
    [isAuthenticated],
  );

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      persist(THEME_KEY, next);
      save({ theme: next, fontSize });
    },
    [fontSize, save],
  );

  const setFontSize = useCallback(
    (next: FontSizePreference) => {
      setFontSizeState(next);
      persist(FONT_SIZE_KEY, next);
      save({ theme, fontSize: next });
    },
    [theme, save],
  );

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, fontSize, setTheme, setFontSize }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
