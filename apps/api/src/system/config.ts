import { str } from "@/config/parse";
import { warnInProduction } from "@/config/required";

export const systemConfig = {
  appVersion: str(process.env.APP_VERSION, "dev"),
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
