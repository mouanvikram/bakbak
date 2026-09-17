import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getSettings, updateAppearance } from "@/features/settings/api";
import { reportError } from "@/lib/report";
import { STORAGE_KEYS, readString, writeString } from "@/lib/storage";
import {
  ThemeContext,
  type FontSizePreference,
  type ThemePreference,
} from "./theme-context";

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
    readString<ThemePreference>(STORAGE_KEYS.theme, "light"),
  );
  const [fontSize, setFontSizeState] = useState<FontSizePreference>(() =>
    readString<FontSizePreference>(STORAGE_KEYS.fontSize, "small"),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolve(theme),
  );

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

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getSettings()
      .then((res) => {
        if (cancelled) return;
        setThemeState(res.appearance.theme);
        setFontSizeState(res.appearance.fontSize);
        writeString(STORAGE_KEYS.theme, res.appearance.theme);
        writeString(STORAGE_KEYS.fontSize, res.appearance.fontSize);
      })
      .catch((err: unknown) => reportError("settings:load", err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const save = useCallback(
    (next: { theme: ThemePreference; fontSize: FontSizePreference }) => {
      if (!isAuthenticated) return;
      void updateAppearance(next).catch((err: unknown) =>
        reportError("settings:appearance:save", err),
      );
    },
    [isAuthenticated],
  );

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      writeString(STORAGE_KEYS.theme, next);
      save({ theme: next, fontSize });
    },
    [fontSize, save],
  );

  const setFontSize = useCallback(
    (next: FontSizePreference) => {
      setFontSizeState(next);
      writeString(STORAGE_KEYS.fontSize, next);
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
