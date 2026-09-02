import { createContext, useContext } from "react";
import type { AppearanceSettingsType } from "@bakbak/contracts";

export type ThemePreference = AppearanceSettingsType["theme"];
export type FontSizePreference = AppearanceSettingsType["fontSize"];

export interface ThemeContextValue {
  /** The user's stored preference: "light" | "dark" | "system". */
  theme: ThemePreference;
  /** The theme actually applied right now (system resolved to light/dark). */
  resolvedTheme: "light" | "dark";
  fontSize: FontSizePreference;
  /** Update + apply immediately. Persists to the API when authenticated. */
  setTheme: (theme: ThemePreference) => void;
  setFontSize: (size: FontSizePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
