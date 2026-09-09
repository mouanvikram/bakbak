import { createServer } from "node:http";
import { Server } from "socket.io";
import { type Request, type Response } from "express";
import { prisma } from "@bakbak/db";
import app from "./src/app";
import { env } from "./src/config";
import { initializeWebSocket } from "./src/websocket";
import { refreshTokenRepository } from "./src/services/service.container";
import { closeRedisClient } from "./src/redis/client";
import logger from "@/lib/logger";

const REFRESH_TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const SHUTDOWN_GRACE_MS = 10_000;

app.get("/", (_: Request, res: Response) => {
	return res.status(200).json({
		message: "Path is at '/' ",
	});
});

app.get("/healthz", (_: Request, res: Response) => res.status(200).json({ status: "ok" }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
	cors: {
		origin: env.CORS_ORIGINS,
		credentials: true,
	},
});

initializeWebSocket(io);

async function cleanUpExpiredTokens() {
	try {
		const result = await refreshTokenRepository.deleteExpired();
		if (result.count > 0) {
			logger.info(
				{ deleted: result.count },
				"Cleaned up expired refresh tokens",
			);
		}
	} catch (error) {
		logger.error({ err: error }, "Failed to clean up expired refresh tokens");
	}
}

cleanUpExpiredTokens();
const tokenCleanupTimer = setInterval(
	cleanUpExpiredTokens,
	REFRESH_TOKEN_CLEANUP_INTERVAL_MS,
);
tokenCleanupTimer.unref?.();

httpServer.listen(env.PORT, () => {
	logger.info(`Server is listening at http://localhost:${env.PORT}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────
let shuttingDown = false;

async function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info({ signal }, "Shutting down");

	// Stop background timers so nothing new is scheduled mid-teardown.
	clearInterval(tokenCleanupTimer);
	closeRedisClient();

	// Force-exit if a connection refuses to drain in time.
	const killTimer = setTimeout(() => {
		logger.error("Forced shutdown after grace period");
		process.exit(1);
	}, SHUTDOWN_GRACE_MS);
	killTimer.unref();

	try {
		await io.close();
		await new Promise<void>((resolve, reject) =>
			httpServer.close((err) => (err ? reject(err) : resolve())),
		);
		await prisma.$disconnect();
		clearTimeout(killTimer);
		logger.info("Shutdown complete");
		process.exit(0);
	} catch (err) {
		logger.error({ err }, "Error during shutdown");
		process.exit(1);
	}
}

// A crash must leave a structured line behind: without these, Node dumps an
// unformatted stack to stderr and the log pipeline never sees it. Both are
// unrecoverable by definition — log, flush, let the orchestrator restart us.
process.on("uncaughtException", (err) => {
	logger.fatal({ err }, "Uncaught exception");
	logger.flush?.();
	process.exit(1);
});

// Node terminates on an unhandled rejection anyway (>= v15); this only makes
// the reason legible on the way out.
process.on("unhandledRejection", (reason) => {
	logger.fatal({ err: reason }, "Unhandled promise rejection");
	logger.flush?.();
	process.exit(1);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
	process.on(signal, () => void shutdown(signal));
}
