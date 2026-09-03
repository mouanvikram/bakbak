import type { ErrorRequestHandler } from "express";
import { Prisma } from "@bakbak/db";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import logger from "@/lib/logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
	if (err?.type === "entity.too.large") {
		return res.status(413).json({
			error: {
				code: "PAYLOAD_TOO_LARGE",
				message: "Request payload is too large.",
			},
		});
	}

	if (err instanceof AppError) {
		return res.status(err.statusCode).json({
			error: {
				code: err.code,
				message: err.message,
				...(err.details !== undefined ? { details: err.details } : {}),
			},
		});
	}

	logger.error(
		{
			err,
			method: req.method,
			url: req.originalUrl,
			requestId: req.requestId,
		},
		"Unhandled error",
	);

	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2025") {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				error: {
					code: ERROR_CODES.NOT_FOUND,
					message: "Resource not found",
				},
			});
		}

		if (err.code === "P2002") {
			return res.status(HTTP_STATUS.CONFLICT).json({
				error: {
					code: ERROR_CODES.CONFLICT,
					message: "Resource already exists",
				},
			});
		}

		// Foreign-key violation — the request references a row that doesn't exist
		// (e.g. adding a participant for an unknown user id).
		if (err.code === "P2003") {
			return res.status(HTTP_STATUS.NOT_FOUND).json({
				error: {
					code: ERROR_CODES.NOT_FOUND,
					message: "Referenced resource not found",
				},
			});
		}

		// Malformed value for the column type — almost always a bad UUID in the
		// path/body that slipped past validation.
		if (err.code === "P2023") {
			return res.status(HTTP_STATUS.BAD_REQUEST).json({
				error: {
					code: ERROR_CODES.BAD_REQUEST,
					message: "Malformed identifier",
				},
			});
		}
	}

	return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
		error: {
			code: ERROR_CODES.INTERNAL_SERVER_ERROR,
			message: "Internal server error",
		},
	});
};
