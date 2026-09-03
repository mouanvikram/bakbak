import { createServer } from "node:http";
import { Server } from "socket.io";
import { type Request, type Response } from "express";
import app from "./src/app";
import { env } from "./src/config";
import { initializeWebSocket } from "./src/websocket";
import { refreshTokenRepository } from "./src/services/service.container";
import logger from "@/lib/logger";

const REFRESH_TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

app.get("/", (_: Request, res: Response) => {
	return res.status(200).json({
		message: "Path is at '/' ",
	});
});

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
setInterval(cleanUpExpiredTokens, REFRESH_TOKEN_CLEANUP_INTERVAL_MS);

httpServer.listen(env.PORT, () => {
	logger.info(`Server is listening at http://localhost:${env.PORT}`);
});
