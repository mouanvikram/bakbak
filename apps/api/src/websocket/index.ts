import type { Server } from "socket.io";
import { prisma } from "@bakbak/db";
import logger from "@/lib/logger";
import { socketAuthMiddleware } from "./auth";
import { registerConnection } from "./connection";
import { setIo } from "./emitter";
import { setRefIo } from "./connection";

export function initializeWebSocket(io: Server) {
	setIo(io);
	setRefIo(io);

	// This process owns presence for every connected user. On a fresh start
	// nobody is connected yet, so clear any `isOnline` flags left true by a
	// previous crash/restart.
	void prisma.userProfile
		.updateMany({ where: { isOnline: true }, data: { isOnline: false } })
		.catch((err: unknown) =>
			logger.warn({ err }, "Failed to reset stale presence flags on startup"),
		);

	io.use(socketAuthMiddleware);

	io.on("connection", (socket) => {
		registerConnection(io, socket);
	});
}
