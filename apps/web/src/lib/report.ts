/**
 * Surface a background failure that has no place in the UI — a preference that
 * didn't save, a list that didn't load, a read receipt that didn't land.
 *
 * These paths are deliberately fail-soft (the app keeps working on its local
 * value), but swallowing them silently makes them invisible while developing.
 * Logged in dev only, so a flaky network never spams a user's console.
 */
export function reportError(scope: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, error);
}
