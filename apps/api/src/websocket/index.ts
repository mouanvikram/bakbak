import type { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth";
import { registerConnection } from "./connection";
import { setIo } from "./emitter";
import { setRefIo } from "./connection";

export function initializeWebSocket(io: Server) {
	setIo(io);
	setRefIo(io);

	io.use(socketAuthMiddleware);

	io.on("connection", (socket) => {
		registerConnection(io, socket);
	});
}
