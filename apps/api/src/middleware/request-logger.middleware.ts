import type { NextFunction, Request, Response } from "express";
import logger from "@lib/logger";

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
				url: req.originalUrl,
				status: res.statusCode,
				durationMs,
				requestId: (req as any).id,
				userAgent: req.headers["user-agent"],
				ip: req.ip,
			},
			"HTTP request",
		);
	});

	next();
};
