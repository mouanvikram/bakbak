import { resolve } from "node:path";
import dotenv from "dotenv";
import { nonNegativeInt, positiveNum } from "./parse";
import { isProduction, warnInProduction } from "./required";

dotenv.config({
  path: resolve(import.meta.dir, "../../../../.env"),
  quiet: true,
});

// Global-only config: process identity + HTTP surface. Everything
// module-specific lives in that module's own config file
// (apps/api/src/<module>/config.ts), which reads process.env directly so
// no import cycle through here is possible.
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/;

// The localhost defaults are a dev convenience, so production has to name its
// origins explicitly rather than inherit them.
function parseOrigins(raw?: string): string[] {
  const origins =
    raw
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (!isProduction()) {
    return origins.length ? origins : DEFAULT_CORS_ORIGINS;
  }

  if (!origins.length) {
    throw new Error(
      "CORS_ORIGINS is missing and is required when NODE_ENV=production; " +
        "the localhost defaults must not ship. See .env.example.",
    );
  }

  const local = origins.filter((origin) => LOCAL_ORIGIN.test(origin));
  if (local.length) {
    throw new Error(
      `CORS_ORIGINS contains development origins (${local.join(", ")}), ` +
        "which must not be allowed in production. See .env.example.",
    );
  }

  return origins;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: positiveNum(process.env.PORT, 3000),
  CORS_ORIGINS: parseOrigins(process.env.CORS_ORIGINS),
  // Reverse-proxy hops in front of the API (0 = none — X-Forwarded-For
  // ignored, req.ip is the socket peer).
  TRUST_PROXY: nonNegativeInt(process.env.TRUST_PROXY, 0),
};

warnInProduction(
  env.TRUST_PROXY === 0,
  "TRUST_PROXY is 0 — if the API sits behind a reverse proxy, X-Forwarded-For " +
    "is ignored and every rate-limit bucket keys on the proxy's IP, making one " +
    "shared bucket for all clients.",
);
