import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const requestIdMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const requestId =
		req.headers["x-request-id"]?.toString() ||
		req.headers["x-correlation-id"]?.toString() ||
		randomUUID();

	req.requestId = requestId;
	res.setHeader("x-request-id", requestId);

	next();
};
