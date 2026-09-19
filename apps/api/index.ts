import { createServer } from "node:http";
import { Server } from "socket.io";
import "@/shutdown";
import { startJobs } from "@/jobs";
import app from "@/app";
import { env } from "@/config";
import { initializeWebSocket } from "@/websocket";
import { getRedisClient, isRedisReady } from "@/redis/client";
import { registerShutdownHook } from "@/shutdown/registry";
import logger from "@/lib/logger";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    credentials: true,
  },
});

initializeWebSocket(io);

// start background jobs.
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
