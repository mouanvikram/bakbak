import type { Server } from "socket.io";

import { registerConnection } from "./connection";

export function initializeWebSocket(io: Server) {
    io.on("connection", (socket) => {
        registerConnection(io, socket);
    });
}