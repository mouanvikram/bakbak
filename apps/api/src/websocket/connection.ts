import type { Server, Socket } from "socket.io";
import logger from "@logger";

export function registerConnection(
    io: Server,
    socket: Socket,
) {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("disconnect", (reason) => {
        logger.info({ socketId: socket.id, reason }, "Socket disconnected");
    });
}