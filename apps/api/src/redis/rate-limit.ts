import type Redis from "ioredis";
import { getRedisClient, isRedisReady } from "./client";
import type { NextFunction, Request, Response } from "express";
import type { AuthRequest } from "@/auth/controller";
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

function checkAndApplyLimit<R extends Request>(
	build: (req: R) => TokenBucketOptions,
) {
	return async (req: R, res: Response, next: NextFunction) => {
		const redis = getRedisClient();
		if (!redis) return next(); // fail-open
		const opts = build(req);

		res.setHeader("RateLimit-Limit", String(opts.capacity));
		const resetIn = Math.ceil(opts.capacity / opts.refillRate);
		res.setHeader(
			"RateLimit-Reset",
			String(Math.floor(Date.now() / 1000) + resetIn),
		);

		if (!isRedisReady()) {
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

// global rate-limiter how many total request can come
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
// emails/usernames mint a fresh bucket every attempt.
export function rateLimitIp(bucket: RateLimitBucketName) {
	return checkAndApplyLimit((req: Request) => ({
		key: `rl:${bucket}:${req.ip || "unknown"}`,
		...redisConfig.rateLimit[bucket],
	}));
}

// The mail-sending bucket (signup, resend-verification, forgot-password) —
// per-IP, for the reasons above.
export const rateLimitEmails = () => rateLimitIp("email");

// The username-availability check — per-IP, because per-submitted-username
// buckets don't stop enumeration.
export const rateLimitUsernameCheck = () => rateLimitIp("usernameCheck");