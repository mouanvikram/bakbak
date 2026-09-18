import type Redis from "ioredis";
import { getRedisClient, isRedisReady, isRedisUnavailable } from "./client";
import type { NextFunction, Request, Response } from "express";
import { redisConfig } from "./config";
import type { RateLimitBucketName } from "./config";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import logger from "@/lib/logger";

export type TokenBucketOptions = {
  key: string;
  capacity: number;
  refillRate: number;
  cost?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

// The command is registered on the shared client in client.ts (defineCommand),
// so ioredis runs it via EVALSHA after the first call.
type BucketCommander = {
  consumeBucket: (
    key: string,
    ...args: Array<string | number>
  ) => Promise<[number, number, number]>;
};

async function consumeToken(
  redis: Redis,
  options: TokenBucketOptions,
): Promise<RateLimitResult> {
  const { key, capacity, refillRate } = options;
  // A cost above the bucket capacity could never be satisfied and would
  // report a plausible-but-never-true retry; clamp it to a satisfiable size.
  const cost = Math.min(options.cost ?? 1, capacity);
  const [allowed, remaining, retryAfter] = await (
    redis as unknown as BucketCommander
  ).consumeBucket(key, capacity, refillRate, cost);

  return {
    allowed: allowed === 1,
    remaining,
    retryAfter,
  };
}

// The seam the middleware reads limiter state through: the real store binds to
// the shared client; tests inject a fake one (a null/dead client) to exercise
// the fail-closed / fail-open branches without touching Redis or relying on
// process-global module mocks.
export type LimiterStore = {
  getRedisClient: () => Redis | null;
  isRedisReady: () => boolean;
  // True when the store is in a *genuine* outage rather than merely still
  // connecting for the first time (see client.ts) — only this state triggers
  // fail-closed, so a cold start never 503s the security buckets.
  isRedisUnavailable: () => boolean;
};

// Builds a limiter bound to a store. Exported so tests can drive the exact
// decision logic with a fake store; production uses the real client store.
export function makeRateLimiter(store: LimiterStore) {
  return function checkAndApplyLimit<R extends Request>(
    build: (req: R) => TokenBucketOptions,
    {
      // Security-critical buckets (login, email) refuse to serve traffic while
      // Redis is unusable instead of silently unthrottled; everything else
      // fails open so one Redis hiccup can't take the whole API down.
      failClosed = false,
    }: { failClosed?: boolean } = {},
  ) {
    return async (req: R, res: Response, next: NextFunction) => {
      const redis = store.getRedisClient();
      if (!redis) {
        if (failClosed) return void denyWhileLimitingUnavailable(res);
        return next(); // fail-open
      }
      const opts = build(req);

      res.setHeader("RateLimit-Limit", String(opts.capacity));
      const resetIn = Math.ceil(opts.capacity / opts.refillRate);
      res.setHeader(
        "RateLimit-Reset",
        String(Math.floor(Date.now() / 1000) + resetIn),
      );

      if (!store.isRedisReady()) {
        // Only a real outage fails closed; a cold-start process that has not
        // finished its first connect yet is allowed through unthrottled so the
        // first request of a freshly booted API never gets a spurious 503.
        if (failClosed && store.isRedisUnavailable())
          return void denyWhileLimitingUnavailable(res);
        res.setHeader("RateLimit-Remaining", String(opts.capacity));
        return next();
      }

      try {
        const { allowed, remaining, retryAfter } = await consumeToken(
          redis,
          opts,
        );
        res.setHeader("RateLimit-Remaining", String(remaining));

        // if limit is left. let the request go to the next stop.
        if (allowed) return next();

        // if not set retry-after header.
        res.setHeader("Retry-After", String(retryAfter));
        throw new AppError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          "Too many requests. Please try again shortly.",
        );
      } catch (error) {
        if (error instanceof AppError) throw error; // let the 429 ride
        if (failClosed) return void denyWhileLimitingUnavailable(res);
        logger.warn(
          { err: error, ip: req.ip, path: req.path },
          "Rate-limit check failed; failing open",
        );
        return next();
      }
    };
  };
}

// Refuse the request while the limiter itself is down: for a security bucket
// a 503 is better than running unthrottled. Throwing lets the error handler
// shape the response the same way a 429 would.
function denyWhileLimitingUnavailable(res: Response): void {
  res.setHeader("Retry-After", "60");
  throw new AppError(
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    ERROR_CODES.SERVICE_UNAVAILABLE,
    "Rate limiting is temporarily unavailable. Please try again shortly.",
  );
}

// Key shape: rl:<dimension>:<bucket>:<identity>. The dimension ("user" or "ip")
// is part of the key so the same bucket can never collide across identity
// types even if its keying semantics change later.
function bucketKey(
  dimension: "user" | "ip",
  bucket: string,
  identity: string,
): string {
  return `rl:${dimension}:${bucket}:${identity}`;
}

// global rate-limiter how many total request can come
// from a single ip per minute.
export function rateLimitGlobal() {
  return checkAndApplyLimit((req: Request) => ({
    key: bucketKey("ip", "global", req.ip ?? "unknown"),
    ...redisConfig.rateLimit.global,
  }));
}

// it will rate-limit authorized endpoints
// like uploads, chat creation, message sending etc.
export function rateLimitAuthorized(bucket: RateLimitBucketName) {
  return checkAndApplyLimit((req: Request) => {
    const userId = req.user?.userId;
    return {
      key: bucketKey(userId ? "user" : "ip", bucket, userId ?? req.ip ?? "unknown"),
      ...redisConfig.rateLimit[bucket],
    };
  });
}

// Per-IP rate limit for a named bucket. Used on public endpoints (login,
// signup, mail-sending routes, username checks) where the submitted email or
// username is attacker-controlled — keying by it would let a loop of rotating
// emails/usernames mint a fresh bucket every attempt.
export function rateLimitIp(
  bucket: RateLimitBucketName,
  options?: { failClosed?: boolean },
) {
  return checkAndApplyLimit(
    (req: Request) => ({
      key: bucketKey("ip", bucket, req.ip || "unknown"),
      ...redisConfig.rateLimit[bucket],
    }),
    options,
  );
}

// The mail-sending bucket (signup, resend-verification, forgot-password) —
// per-IP, for the reasons above. Fails closed: a mail flood while Redis is
// down is worse than a briefly-unavailable signup.
export const rateLimitEmails = () =>
  rateLimitIp("email", { failClosed: true });

// The username-availability check — per-IP, because per-submitted-username
// buckets don't stop enumeration.
export const rateLimitUsernameCheck = () => rateLimitIp("usernameCheck");

// The production limiter, bound to the real shared client store. Exported for
// the rate-limit tests, which exercise the middleware against an isolated
// bucket key instead of sharing a production one.
export const checkAndApplyLimit = makeRateLimiter({
  getRedisClient,
  isRedisReady,
  isRedisUnavailable,
});
