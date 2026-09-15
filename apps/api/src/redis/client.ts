import Redis from "ioredis";
import logger from "@/lib/logger";
import { registerShutdownHook } from "@/shutdown/registry";
import { getRedisConnectionOptions } from "./config";
import { TOKEN_BUCKET_SCRIPT } from "./lua.scripts";
import {
  PRESENCE_RELEASE_SCRIPT,
  PRESENCE_SWEEP_SCRIPT,
  PRESENCE_TOUCH_SCRIPT,
} from "./presence/lua.scripts";

let redis: Redis | null = null;

// Gate for the cache: true only while a connection is actually usable.
export function isRedisReady(): boolean {
  return redis?.status === "ready";
}

export function getRedisClient(): Redis {
  if (redis) {
    return redis;
  }

  redis = new Redis({
    ...getRedisConnectionOptions(),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.defineCommand("consumeBucket", {
    numberOfKeys: 1,
    lua: TOKEN_BUCKET_SCRIPT,
  });

  // Cluster presence
  redis.defineCommand("presenceTouch", {
    numberOfKeys: 2,
    lua: PRESENCE_TOUCH_SCRIPT,
  });
  redis.defineCommand("presenceRelease", {
    numberOfKeys: 2,
    lua: PRESENCE_RELEASE_SCRIPT,
  });
  redis.defineCommand("presenceSweep", {
    numberOfKeys: 1,
    lua: PRESENCE_SWEEP_SCRIPT,
  });

  redis.on("connect", () => {
    logger.info("[Redis] connected");
  });

  redis.on("ready", () => {
    logger.info("[Redis] ready");
  });

  redis.on("error", (error) => {
    logger.error({ err: error }, "[Redis] error");
  });

  redis.on("close", () => {
    logger.info("[Redis] connection closed");
  });

  redis.on("disconnect", () => {
    logger.info("[Redis] disconnected");
  });

  return redis;
}

export function createAdapterClients(): {
  pub: Redis;
  sub: Redis;
} {
  const pub = getRedisClient().duplicate({
    enableOfflineQueue: true,
    maxRetriesPerRequest: null,
  });
  const sub = pub.duplicate();
  pub.on("error", (err) => logger.error({ err }, "[Redis] adapter pub error"));
  sub.on("error", (err) => logger.error({ err }, "[Redis] adapter sub error"));
  return { pub, sub };
}

export async function closeRedisClient(): Promise<void> {
  if (!redis) return;
  const client = redis;
  redis = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

// Graceful shutdown: close the connection before the process exits.
registerShutdownHook(() => closeRedisClient());
