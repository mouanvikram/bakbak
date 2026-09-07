import type { NextFunction, Request, Response } from "express";
import logger from "@/lib/logger";
import { middlewareConfig } from "./config";

const SENSITIVE_QUERY_PARAMS = new Set(middlewareConfig.sensitiveQueryParams);

function sanitizedUrl(originalUrl: string): string {
	const q = originalUrl.indexOf("?");
	if (q === -1) return originalUrl;
	const params = new URLSearchParams(originalUrl.slice(q + 1));
	for (const key of SENSITIVE_QUERY_PARAMS) {
		if (params.has(key)) params.set(key, "[redacted]");
	}
	return `${originalUrl.slice(0, q)}?${params.toString()}`;
}

export const requestLoggerMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const startTime = Date.now();

	res.on("finish", () => {
		const durationMs = Date.now() - startTime;

		logger.info(
			{
				method: req.method,
				url: sanitizedUrl(req.originalUrl),
				status: res.statusCode,
				durationMs,
				requestId: req.requestId,
				userAgent: req.headers["user-agent"],
				ip: req.ip,
			},
			"HTTP request",
		);
	});

	next();
};
