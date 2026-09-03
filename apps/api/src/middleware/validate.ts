import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { AuthRequest } from "../auth/controller";
import { userIdSchema } from "@bakbak/contracts";
import logger from "@/lib/logger";
import { env } from "@/config";

export function validate<T>(
	schema: ZodType<T>,
	source: "body" | "params" | "query" = "body",
) {
	return (req: Request, _res: Response, next: NextFunction) => {
		const result = schema.safeParse(req[source]);

		if (!result.success) {
			return next(
				new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Validation failed",
					result.error.issues,
				),
			);
		}

		// Expose the parsed (and coerced) value; handlers read `req.valid[source]`
		// instead of the raw, untyped `req[source]`.
		req.valid = { ...req.valid, [source]: result.data };

		next();
	};
}

export function validateUserId() {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		const result = userIdSchema.safeParse({
			userId: req.user?.userId,
		});

		if (!result.success) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.USER_ID_NOT_VALID,
				"User Id must be of type UUID",
			);
		}

		next();
	};
}

export function validateResponse<T>(
	res: Response,
	status: number,
	schema: ZodType<T>,
	data: unknown,
) {
	const result = schema.safeParse(data);

	if (!result.success) {
		logger.error(
			{ issues: result.error.issues, status },
			"Response schema mismatch",
		);

		if (env.NODE_ENV !== "production") {
			throw new AppError(
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID_API_RESPONSE,
				"Invalid response from API",
			);
		}

		return res.status(status).json(data);
	}

	return res.status(status).json(result.data);
}
