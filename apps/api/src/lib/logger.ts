import pino from "pino";
import { env } from "@/config";
import { systemConfig } from "@/system/config";

// Defence in depth: fields a caller could smuggle into a log line must never
// reach the sink. Keep this list in sync whenever a new sensitive field is
// introduced — see tests/logger.test.ts.
export const LOG_REDACT_PATHS: string[] = [
  "password",
  "*.password",
  "currentPassword",
  "*.currentPassword",
  "newPassword",
  "*.newPassword",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "tokenHash",
  "*.tokenHash",
  "hashedToken",
  "*.hashedToken",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "authorization",
  "*.authorization",
  "req.headers.authorization",
  // Only the 2FA `code` on a request body is masked.
  "body.code",
  "req.body.code",
];

export interface LoggerDestination {
  write(msg: string): void;
}

/**
 * Creates a pino logger with the app-wide defaults: env-based level, tagged
 * `base` fields, and the shared redact paths. A custom `destination` is only
 * used in tests — the app itself logs to stdout.
 */
export function createLogger(destination?: LoggerDestination) {
  const options: pino.LoggerOptions = {
    // Overridable without a redeploy; defaults are per-environment.
    level:
      process.env.LOG_LEVEL ??
      (env.NODE_ENV === "production" ? "info" : "debug"),

    // `pid`/`hostname` alone are useless in a container (pid 1, random host id).
    base: {
      service: "bakbak-api",
      env: env.NODE_ENV,
      version: systemConfig.appVersion,
      commit: systemConfig.gitCommit,
    },

    redact: {
      paths: LOG_REDACT_PATHS,
      censor: "[redacted]",
    },
  };

  return destination ? pino(options, destination) : pino(options);
}

const logger = createLogger();

export default logger;