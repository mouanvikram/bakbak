import { Router } from "express";
import { z } from "zod";
import { prisma } from "@bakbak/db";
import { Resend } from "resend";
import { env } from "@/config";
import { emailConfig } from "@/email/config";
import { HTTP_STATUS } from "@/errors/app-error";
import { validateResponse } from "@/middleware/validate";
import { getRedisClient } from "@/redis/client";
import { storageProvider } from "@/uploads/storage";

const READY_TIMEOUT_MS = 3000;

const livenessResponseSchema = z.object({ status: z.literal("ok") });
const readinessResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "unhealthy"]),
  checks: z.object({
    database: z.boolean(),
    redis: z.boolean(),
    storage: z.boolean(),
    email: z.boolean(),
  }),
});

type CheckNames = keyof z.infer<typeof readinessResponseSchema>["checks"];

/** One boolean per dependency — never error text, URLs, or hostnames. */
export type ReadinessCheckers = Record<
  CheckNames,
  () => Promise<boolean>
>;

export type HealthCheckResult = {
  status: "ok" | "degraded" | "unhealthy";
  checks: z.infer<typeof readinessResponseSchema>["checks"];
};

// Read-only providers used by the default checkers.
const resend = new Resend(emailConfig.resendApiKey);

function databasePing() {
  return prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
}

async function redisPing() {
  return getRedisClient().ping().then(() => true).catch(() => false);
}

const storagePing = () => storageProvider.ping();

function emailPing() {
  if (env.NODE_ENV === "test") return Promise.resolve(true);
  return resend.domains.list().then(() => true).catch(() => false);
}

export function createDefaultCheckers(): ReadinessCheckers {
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(resolve, ms)),
    ]);

  return {
    database: async () =>
      (await withTimeout(databasePing(), READY_TIMEOUT_MS)) ?? false,
    redis: async () =>
      (await withTimeout(redisPing(), READY_TIMEOUT_MS)) ?? false,
    storage: async () =>
      (await withTimeout(storagePing(), READY_TIMEOUT_MS)) ?? false,
    email: async () =>
      (await withTimeout(emailPing(), READY_TIMEOUT_MS)) ?? false,
  };
}


export async function runReadinessChecks(
  checkers: ReadinessCheckers = createDefaultCheckers(),
): Promise<HealthCheckResult> {
  const [database, redis, storage, email] = await Promise.all([
    checkers.database(),
    checkers.redis(),
    checkers.storage(),
    checkers.email(),
  ]);

  const checks = { database, redis, storage, email };
  const status =
    !database || !redis
      ? "unhealthy"
      : !storage || !email
        ? "degraded"
        : "ok";

  return { status, checks };
}

// Liveness: the process answers HTTP. Intentionally never queries anything. 
export function createHealthzRouter(): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return validateResponse(
      res,
      HTTP_STATUS.OK,
      livenessResponseSchema,
      { status: "ok" },
    );
  });
  return router;
}

// Readiness: only "go/no-go" booleans, never leaked internals. 
export function createReadyzRouter(
  checkers: ReadinessCheckers = createDefaultCheckers(),
): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const report = await runReadinessChecks(checkers);
    const statusCode =
      report.status === "unhealthy"
        ? HTTP_STATUS.SERVICE_UNAVAILABLE
        : HTTP_STATUS.OK;
    return validateResponse(res, statusCode, readinessResponseSchema, report);
  });
  return router;
}