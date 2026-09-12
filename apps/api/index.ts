import { createServer } from "node:http";
import { Server } from "socket.io";
import { type Request, type Response } from "express";
import "@/shutdown";
import { startJobs } from "@/jobs";
import app from "@/app";
import { env } from "@/config";
import { initializeWebSocket } from "@/websocket";
import { createHealthzRouter, createReadyzRouter } from "@/system/health";
import { registerShutdownHook } from "@/shutdown/registry";
import logger from "@/lib/logger";

app.get("/", (_: Request, res: Response) => {
  return res.status(200).json({
    message: "Path is at '/' ",
  });
});

// Liveness + readiness live in the system module: /healthz is a static
// liveness probe, /readyz checks DB / Redis / storage / Resend connectivity.
app.use("/healthz", createHealthzRouter());
app.use("/readyz", createReadyzRouter());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    credentials: true,
  },
});

initializeWebSocket(io);

startJobs();

// Registered last so it runs first on shutdown (LIFO registry): drain the
// HTTP server before WebSocket/Redis/DB.
registerShutdownHook(
  () =>
    new Promise<void>((resolve, reject) =>
      httpServer.close((err) => (err ? reject(err) : resolve())),
    ),
);

httpServer.listen(env.PORT, () => {
  logger.info(`Server is listening at http://localhost:${env.PORT}`);
});