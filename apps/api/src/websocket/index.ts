import type { Server } from "socket.io";
import { registerShutdownHook } from "@/shutdown/registry";
import { socketAuthMiddleware } from "./auth";
import { registerConnection } from "./connection";
import { setIo } from "./emitter";
import { attachRedisAdapter } from "@/redis/presence/adapter";

export function initializeWebSocket(io: Server) {
  setIo(io);

  // Graceful shutdown: disconnect every connected socket
  registerShutdownHook(attachRedisAdapter(io));
  // redis adapter close before server close.
  registerShutdownHook(() => io.close());

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    registerConnection(io, socket);
  });
}
