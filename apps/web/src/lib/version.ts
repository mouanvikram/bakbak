import type { VersionResponseType } from "@bakbak/contracts";

// CI stamps VITE_APP_VERSION (git tag or short SHA); "dev" for a local build.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION?.trim() || "dev";
export const GIT_COMMIT = import.meta.env.VITE_GIT_COMMIT?.trim() || "";

export type UpdateStatus =
  | { state: "checking" }
  | { state: "latest" }
  | { state: "outdated"; latest: string }
  | { state: "unknown" };

export async function fetchServerVersion(): Promise<VersionResponseType | null> {
  try {
    const res = await fetch("/api/v1/version", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as VersionResponseType;
  } catch {
    return null;
  }
}

// A deploy ships web + API from one commit, so different versions == stale tab.
// If either side is an unstamped local build we can't tell.
export function compareVersions(
  server: VersionResponseType | null,
): UpdateStatus {
  if (!server) return { state: "unknown" };
  if (APP_VERSION === "dev" || server.version === "dev") {
    return { state: "unknown" };
  }
  return APP_VERSION === server.version
    ? { state: "latest" }
    : { state: "outdated", latest: server.version };
}
