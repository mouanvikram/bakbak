import type { NextFunction, Request, Response } from "express";
import { env } from "@/config";
import logger from "@/lib/logger";

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
		(ts) => now - ts < env.RATE_LIMIT_WINDOW_MS,
	);

	if (window.timestamps.length === 0 && window.blockedUntil <= now) {
		clients.delete(key);
	}
}

setInterval(() => {
	const now = Date.now();
	for (const key of clients.keys()) {
		pruneOldEntries(key, now);
	}
}, env.RATE_LIMIT_WINDOW_MS);

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
			return res.status(429).json({
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many requests. Please try again later.",
				},
			});
		}

		pruneOldEntries(key, now);
	}

	const current = clients.get(key) || { timestamps: [], blockedUntil: 0 };
	current.timestamps.push(now);

	if (current.timestamps.length > env.RATE_LIMIT_MAX_REQUESTS) {
		current.blockedUntil = now + env.RATE_LIMIT_WINDOW_MS;
		clients.set(key, current);

		const retryAfter = Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000);
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

		return res.status(429).json({
			error: {
				code: "RATE_LIMIT_EXCEEDED",
				message: "Too many requests. Please try again later.",
			},
		});
	}

	clients.set(key, current);
	next();
};
