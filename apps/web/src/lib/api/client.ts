import {
  clearTokens,
  dedupeRefresh,
  getAccessToken,
  getRefreshToken,
} from "./tokens";

export async function apiClient<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401 && getRefreshToken() && endpoint !== "/api/v1/auth/refresh-token") {
    try {
      const newToken = await dedupeRefresh();

      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(endpoint, {
        ...options,
        headers,
      });
    } catch {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error?.message ?? body.message ?? `Request failed (${res.status})`,
    );
  }

  return res.json();
}
