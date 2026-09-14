// Connection plus the token-bucket rate-limit and cache policies. Every bucket is capacity (burst) + refillRate (per second).
import type { RedisOptions } from "ioredis";
import {
  bool,
  nonNegativeInt,
  positiveNum,
  str,
} from "@/config/parse";

export const redisConfig = {
  rateLimit: {
    global: {
      capacity: positiveNum(process.env.RATE_LIMIT_GLOBAL_CAPACITY, 200),
      refillRate: positiveNum(process.env.RATE_LIMIT_GLOBAL_REFILL_PER_SEC, 4),
    },

    login: {
      capacity: positiveNum(process.env.RATE_LIMIT_LOGIN_CAPACITY, 20),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_LOGIN_REFILL_PER_SEC,
        1 / 3,
      ),
    },

    email: {
      capacity: positiveNum(process.env.RATE_LIMIT_EMAIL_CAPACITY, 8),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_EMAIL_REFILL_PER_SEC,
        1 / 120,
      ),
    },

    uploads: {
      capacity: positiveNum(process.env.RATE_LIMIT_UPLOADS_CAPACITY, 20),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_UPLOADS_REFILL_PER_SEC,
        1 / 3,
      ),
    },

    messageSend: {
      capacity: positiveNum(process.env.RATE_LIMIT_MESSAGE_SEND_CAPACITY, 60),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_MESSAGE_SEND_REFILL_PER_SEC,
        2,
      ),
    },

    usernameCheck: {
      capacity: positiveNum(process.env.RATE_LIMIT_USERNAME_CHECK_CAPACITY, 20),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_USERNAME_CHECK_REFILL_PER_SEC,
        1,
      ),
    },

    friendRequest: {
      capacity: positiveNum(process.env.RATE_LIMIT_FRIEND_REQUEST_CAPACITY, 20),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_FRIEND_REQUEST_REFILL_PER_SEC,
        1 / 20,
      ),
    },

    chat: {
      capacity: positiveNum(process.env.RATE_LIMIT_CHAT_CAPACITY, 25),
      refillRate: positiveNum(
        process.env.RATE_LIMIT_CHAT_REFILL_PER_SEC,
        1 / 8,
      ),
    },
  },
  cache: {
    defaultTtlSec: positiveNum(process.env.CACHE_DEFAULT_TTL_SEC, 300),
  },
};

export type RateLimitBucketName = keyof typeof redisConfig.rateLimit;

// ioredis options for the shared connection. REDIS_URL wins when set:
// parse scheme (redis:/rediss:), credentials, port, and a /db path. Otherwise
// fall back to REDIS_HOST/PORT plus optional REDIS_PASSWORD / REDIS_DB /
// REDIS_TLS. rediss: and REDIS_TLS put the connection on TLS.
export function getRedisConnectionOptions(): RedisOptions {
  const url = str(process.env.REDIS_URL, "");
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      throw new Error(
        `Unsupported REDIS_URL scheme "${parsed.protocol}" — expected redis: or rediss:`,
      );
    }
    const urlDb =
      parsed.pathname && parsed.pathname !== "/"
        ? Number(parsed.pathname.slice(1))
        : NaN;
    const db =
      Number.isInteger(urlDb) && urlDb >= 0
        ? urlDb
        : nonNegativeInt(process.env.REDIS_DB, 0);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      ...(parsed.username ? { username: parsed.username } : {}),
      ...(parsed.password ? { password: parsed.password } : {}),
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
      ...(db > 0 ? { db } : {}),
    };
  }

  const password = str(process.env.REDIS_PASSWORD, "");
  const db = nonNegativeInt(process.env.REDIS_DB, 0);
  return {
    host: str(process.env.REDIS_HOST, "localhost"),
    port: positiveNum(process.env.REDIS_PORT, 6379),
    ...(password ? { password } : {}),
    ...(db > 0 ? { db } : {}),
    ...(bool(process.env.REDIS_TLS, false) ? { tls: {} } : {}),
  };
}
