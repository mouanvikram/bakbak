import Redis from "ioredis";
import { getRedisClient } from "./client";
import type { NextFunction, Request, Response } from "express";
import type { AuthRequest } from "@/auth/controller";
import { redisConfig } from "./config";
import type { RateLimitBucketName } from "./config";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import logger from "@/lib/logger";

// lua script is used for
// concurrency/burst protection.
// it executes each request in sequential order.
const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local tokens = tonumber(redis.call("HGET", KEYS[1], "tokens"))
local timestamp = tonumber(redis.call("HGET", KEYS[1], "timestamp"))

if tokens == nil then
    tokens = capacity
end

if timestamp == nil then
    timestamp = now
end

local elapsed = math.max(0, now - timestamp)
local refill = (elapsed / 1000) * refill_rate

tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local missing = requested - tokens

    if refill_rate > 0 then
        retry_after = math.ceil(missing / refill_rate)
    end
end

redis.call(
    "HSET",
    KEYS[1],
    "tokens", tokens,
    "timestamp", now
)

local ttl = math.ceil(capacity / refill_rate)

if ttl > 0 then
    redis.call("EXPIRE", KEYS[1], ttl)
end

local remaining = math.floor(tokens)

return {
    allowed,
    remaining,
    retry_after
}
`;

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

async function consumeToken(
	redis: Redis,
	options: TokenBucketOptions,
): Promise<RateLimitResult> {
	const { key, capacity, refillRate, cost = 1 } = options;
	const [allowed, remaining, retryAfter] = (await redis.eval(
		TOKEN_BUCKET_SCRIPT,
		1, //no of keys
		key, // 1 key
		// rest of the arguments ARGV =
		// ARGV[1] = capacity. max-capacity of bucket.
		capacity,
		// ARGV[2] = refillRate. ( e.g 1 token per second)
		refillRate,
		// ARGV[3] = now. (current timestamp) to calculate minted tokens in the elapsed duration
		Date.now(),
		// how many tokens this should deduct.
		cost,
	)) as [number, number, number];

	return {
		allowed: allowed === 1,
		remaining,
		retryAfter,
	};
}

function checkAndApplyLimit<R extends Request>(
	build: (req: R) => TokenBucketOptions,
) {
	return async (req: R, res: Response, next: NextFunction) => {
		const redis = getRedisClient();
		if (!redis) return next(); // fail-open
		try {
			const opts = build(req);
			const { allowed, remaining, retryAfter } = await consumeToken(
				redis,
				opts,
			);
			res.setHeader("RateLimit-Limit", String(opts.capacity));
			res.setHeader("RateLimit-Remaining", String(remaining));

            // if limit is left. let 
            // the request go next stop.
			if (allowed) return next();

            // if not set retry-after header.
			res.setHeader("Retry-After", String(retryAfter));
			throw new AppError(
				HTTP_STATUS.TOO_MANY_REQUESTS,
				ERROR_CODES.RATE_LIMIT_EXCEEDED,
				"Too many requests. Please try again later.",
			);
		} catch (error) {
			if (error instanceof AppError) throw error; // let the 429 ride
			logger.warn(
				{ err: error, ip: req.ip, path: req.path },
				"Rate-limit check failed; failing open",
			);
			return next();
		}
	};
}

//global rate-limiter how many total request can come
// from a single ip per minute.
export function rateLimitGlobal() {
	return checkAndApplyLimit((req: Request) => ({
		key: `rl:global:${req.ip ?? "unknown"}`,
		...redisConfig.rateLimit.global,
	}));
}

// it will rate-limit authorized endpoints
// like uploads, chat creation, message sending etc.
export function rateLimitAuthorized(bucket: RateLimitBucketName) {
	return checkAndApplyLimit((req: AuthRequest) => ({
		key: `rl:${bucket}:${req.user?.userId ?? req.ip ?? "unknown"}`,
		...redisConfig.rateLimit[bucket],
	}));
}

// Per-IP rate limit for a named bucket. Used on public endpoints (login,
// signup, mail-sending routes, username checks) where the submitted email or
// username is attacker-controlled — keying by it would let a loop of rotating
export function rateLimitIp(bucket: RateLimitBucketName) {
	return checkAndApplyLimit((req: Request) => ({
		key: `rl:${bucket}:${req.ip || "unknown"}`,
		...redisConfig.rateLimit[bucket],
	}));
}

// The mail-sending bucket (signup, resend-verification, forgot-password) —
// per-IP, for the reasons above.
export const rateLimitEmails = () => rateLimitIp("email");

// The username-availability bucket (signup check) — per-IP, same reasoning:
// per-submitted-username buckets don't stop enumeration.
export const rateLimitUsernameCheck = () => rateLimitIp("usernameCheck");
