/**
 * Every localStorage key this app owns, and the guarded accessors for them.
 *
 * Storage throws outright in a private window or when site data is blocked, so
 * each access here is best-effort: reads fall back to the caller's default,
 * writes are dropped. Call sites get to stay free of try/catch.
 */

export const STORAGE_KEYS = {
  // `theme` and `fontSize` are mirrored in public/theme-init.js, which runs
  // before the bundle to avoid a flash of the wrong theme and so can't import
  // this module. Renaming either one means editing that file too.
  theme: "bakbak.theme",
  fontSize: "bakbak.fontSize",
  chatPreferences: "bakbak.chatPreferences",
  notifications: "bakbak.notifications",
  sounds: "bakbak.sounds",
  sessionHint: "bakbak.hasSession",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// `T` defaults to `string` and the fallback doesn't drive inference, so a
// caller comparing the result against other values isn't narrowed to the
// fallback's literal type. Pass the union explicitly to get it back:
// `readString<ThemePreference>(STORAGE_KEYS.theme, "light")`.
export function readString<T extends string = string>(
  key: StorageKey,
  fallback: NoInfer<T>,
): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeString(key: StorageKey, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the value is a convenience, not a source of truth */
  }
}

/**
 * Reads a stored object over `defaults`, so a value written by an older build
 * that's missing newer fields still yields a complete one.
 *
 * Only fields the defaults declare, with a matching type, are taken: storage is
 * editable by hand, and a stale or tampered entry shouldn't be able to put a
 * string where the app expects a boolean.
 */
export function readJson<T extends object>(key: StorageKey, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged = { ...defaults } as Record<string, unknown>;
    for (const [field, value] of Object.entries(parsed)) {
      if (field in merged && typeof value === typeof merged[field]) {
        merged[field] = value;
      }
    }
    return merged as T;
  } catch {
    return defaults;
  }
}

export function writeJson(key: StorageKey, value: object) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* see writeString */
  }
}

export function removeKey(key: StorageKey) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* see writeString */
  }
}
