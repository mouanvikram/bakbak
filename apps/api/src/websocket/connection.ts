import type { Server, Socket } from "socket.io";

export function registerConnection(
    io: Server,
    socket: Socket,
) {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
        console.log(
            `Socket disconnected: ${socket.id}`,
            reason,
        );
    });
}