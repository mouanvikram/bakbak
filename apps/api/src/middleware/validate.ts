import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export function validate<T>(
	schema: ZodType<T>,
	source: "body" | "params" | "query" = "body",
) {
	return (req: Request, res: Response, next: NextFunction) => {
		const result = schema.safeParse(req[source]);

		if (!result.success) {
			return res.status(400).json({
				error: "Validation failed",
				issues: result.error.issues,
			});
		}

		next();
	};
}

export function validateResponse<T>(
	res: Response,
	status: number,
	schema: ZodType<T>,
	data: T,
) {
	const result = schema.safeParse(data);

	if (!result.success) {
		throw new AppError(
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			ERROR_CODES.INVALID_API_RESPONSE,
			"Internal server error",
		);
	}
	return res.status(status).json(result.data);
}
