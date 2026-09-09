// Connection plus the token-bucket rate-limit and cache policies. Every bucket is capacity (burst) + refillRate (per second).
import { positiveNum } from "@/config/parse";

export const redisConfig = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: positiveNum(process.env.REDIS_PORT, 6379),
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
