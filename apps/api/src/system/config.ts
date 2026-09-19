import { readFileSync } from "node:fs";
import { join } from "node:path";
import { str } from "@/config/parse";
import { warnInProduction } from "@/config/required";

/**
 * The app version, read from the repo root package.json.
 *
 * Read off disk rather than imported so the version is not baked into a build
 * artifact — the same file is the one `bun pm version` bumps, and it is what
 * both the API and the web client compare to decide a tab is stale.
 */
function readPackageVersion(): string {
  try {
    const pkg = readFileSync(
      join(import.meta.dir, "../../../../package.json"),
      "utf8",
    );
    return (JSON.parse(pkg) as { version?: string }).version || "0.0.0";
  } catch {
    // A packaged deployment that lost the root package.json should still boot;
    // the version check degrades to "unknown" rather than crashing the server.
    return "0.0.0";
  }
}

export const systemConfig = {
  appVersion: str(process.env.APP_VERSION, readPackageVersion()),
  gitCommit: str(
    process.env.GIT_COMMIT,
    str(process.env.VERCEL_GIT_COMMIT_SHA, "unknown"),
  ),
  buildTime: str(process.env.BUILD_TIME, new Date().toISOString()),
  // When set, GET /metrics requires this as `Authorization: Bearer <token>`.
  // Empty keeps the endpoint public (local dev).
  metricsAuthToken: str(process.env.METRICS_AUTH_TOKEN, ""),
};

warnInProduction(
  !systemConfig.metricsAuthToken,
  "METRICS_AUTH_TOKEN is unset — the Prometheus /metrics endpoint is public. " +
    "Set a bearer token and configure the scraper to send it.",
);
