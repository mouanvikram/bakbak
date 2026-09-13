// The access token lives only in memory and the refresh token in an httpOnly
// cookie the browser attaches to /api/v1/auth/refresh-token — neither can be
// read from storage, so an XSS can't lift a long-lived credential.
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

// Non-secret hint that a refresh cookie probably exists (scripts can't see it),
// so a signed-out visitor doesn't fire a doomed refresh on every page load.
const SESSION_HINT_KEY = "bakbak.hasSession";

// Earlier builds persisted both tokens in localStorage; drop any leftovers.
try {
  localStorage.removeItem("bakbak_access_token");
  localStorage.removeItem("bakbak_refresh_token");
} catch {
  // Storage blocked — nothing to clean up.
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function storeAccessToken(token: string) {
  accessToken = token;
  try {
    localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // The hint is best-effort.
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // The hint is best-effort.
  }
}

export function hasSession(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function postRefresh(): Promise<Response> {
  return fetch("/api/v1/auth/refresh-token", {
    method: "POST",
    credentials: "include",
  });
}

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code?: string };
  };
  return body.error?.code;
}

async function refreshAccessToken(): Promise<string> {
  let res = await postRefresh();

  // The cookie was rotated a moment ago (another tab, or a retried request
  // whose response was lost). The browser already holds the new cookie, so
  // one retry picks it up.
  if (
    res.status === 401 &&
    (await errorCode(res)) === "REFRESH_TOKEN_ROTATED"
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    res = await postRefresh();
  }

  if (!res.ok) {
    throw new Error("Refresh failed");
  }

  const data = (await res.json()) as { accessToken: string };
  storeAccessToken(data.accessToken);
  return data.accessToken;
}

// Serialises refreshes across tabs: the cookie is shared, so two tabs must not
// present the same one at once. Without Web Locks it's in-tab dedupe only.
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if ("locks" in navigator) {
    return navigator.locks.request("bakbak-auth-refresh", () =>
      fn(),
    ) as Promise<T>;
  }
  return fn();
}

export function dedupeRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = withCrossTabLock(refreshAccessToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
