import { prisma } from "@bakbak/db";
import logger from "@/lib/logger";
import { registerShutdownHook, runShutdownHooks } from "./registry";

const SHUTDOWN_GRACE_MS = 10_000;

// Registered first so it runs last: consumers (HTTP, WebSocket, Redis)  close before the pool.
registerShutdownHook(() => prisma.$disconnect());

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  // Force-exit if a connection refuses to drain in time.
  const killTimer = setTimeout(() => {
    logger.error("Forced shutdown after grace period");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  killTimer.unref();

  try {
    await runShutdownHooks();
    clearTimeout(killTimer);
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

// A crash must leave a structured line behind:
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  logger.flush?.();
  process.exit(1);
});

// Node terminates on an unhandled rejection anyway (>= v15); this only makes the reason legible on the way out.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  logger.flush?.();
  process.exit(1);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => void shutdown(signal));
}