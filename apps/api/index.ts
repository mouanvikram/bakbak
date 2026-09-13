import { createServer } from "node:http";
import { Server } from "socket.io";
import { type Request, type Response } from "express";
import "@/shutdown";
import { startJobs } from "@/jobs";
import app from "@/app";
import { env } from "@/config";
import { initializeWebSocket } from "@/websocket";
import { createHealthzRouter, createReadyzRouter } from "@/system/health";
import { createMetricsRouter } from "@/system/metrics";
import { getRedisClient, isRedisReady } from "@/redis/client";
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

// Prometheus scrape endpoint, also from the system module.
app.use("/metrics", createMetricsRouter());

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

// Gate the listener on Redis being ready. With `enableOfflineQueue: false`
// the rate-limiter fails open while the client is still connecting, so
// listening before "ready" would serve unthrottled traffic. Waiting on the
// event closes that window; ioredis keeps retrying until Redis is up.
async function startServerGate() {
  const redis = getRedisClient();
  if (!isRedisReady()) {
    await new Promise<void>((resolve) => redis.once("ready", () => resolve()));
  }
  httpServer.listen(env.PORT, () => {
    logger.info(`Server is listening at http://localhost:${env.PORT}`);
  });
}

void startServerGate();
