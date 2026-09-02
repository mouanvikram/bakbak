import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. SSR-safe default is `false`; on the client
 * it reads `window.matchMedia` and re-renders when the match changes.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `lg` breakpoint — the point the app switches to master/detail. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
