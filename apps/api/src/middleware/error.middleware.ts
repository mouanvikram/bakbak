import type { ErrorRequestHandler } from "express";
import { Prisma } from "@bakbak/db";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import logger from "@logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
	if (err instanceof AppError) {
		return res.status(err.statusCode).json({
			error: {
				code: err.code,
				message: err.message,
			},
		});
	}

	logger.error(
		{ err, method: req.method, url: req.originalUrl },
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
	}

	return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
		error: {
			code: ERROR_CODES.INTERNAL_SERVER_ERROR,
			message: "Internal server error",
		},
	});
};
