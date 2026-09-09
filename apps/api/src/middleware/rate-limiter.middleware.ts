import type { NextFunction, Request, Response } from "express";
import { middlewareConfig } from "./config";
import logger from "@/lib/logger";
import { ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

interface ClientWindow {
	timestamps: number[];
	blockedUntil: number;
}

const clients = new Map<string, ClientWindow>();

function getClientKey(req: Request): string {
	return `${req.ip}:${req.route?.path || req.path}`;
}

function pruneOldEntries(key: string, now: number): void {
	const window = clients.get(key);
	if (!window) return;

	window.timestamps = window.timestamps.filter(
		(ts) => now - ts < middlewareConfig.rateLimitWindowMs,
	);

	if (window.timestamps.length === 0 && window.blockedUntil <= now) {
		clients.delete(key);
	}
}

const cleanupTimer = setInterval(() => {
	const now = Date.now();
	for (const key of clients.keys()) {
		pruneOldEntries(key, now);
	}
}, middlewareConfig.rateLimitWindowMs);
// Don't keep the event loop alive just for cleanup.
cleanupTimer.unref?.();

/** Stops the background window-pruning timer (used on graceful shutdown). */
export function stopRateLimiterCleanup() {
	clearInterval(cleanupTimer);
}

export const rateLimiterMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const key = getClientKey(req);
	const now = Date.now();
	const window = clients.get(key);

	if (window) {
		if (window.blockedUntil > now) {
			const retryAfter = Math.ceil((window.blockedUntil - now) / 1000);
			res.setHeader("Retry-After", String(retryAfter));
			return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
				error: {
					code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
					message: "Too many requests. Please try again later.",
				},
			});
		}

		pruneOldEntries(key, now);
	}

	const current = clients.get(key) || { timestamps: [], blockedUntil: 0 };
	current.timestamps.push(now);

	if (current.timestamps.length > middlewareConfig.rateLimitMaxRequests) {
		current.blockedUntil = now + middlewareConfig.rateLimitWindowMs;
		clients.set(key, current);

		const retryAfter = Math.ceil(middlewareConfig.rateLimitWindowMs / 1000);
		res.setHeader("Retry-After", String(retryAfter));

		logger.warn(
			{
				requestId: req.requestId,
				ip: req.ip,
				path: req.path,
				requestCount: current.timestamps.length,
			},
			"Rate limit exceeded",
		);

		return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
			error: {
				code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
				message: "Too many requests. Please try again later.",
			},
		});
	}

	clients.set(key, current);
	next();
};
