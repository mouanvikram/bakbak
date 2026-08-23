import type { ErrorRequestHandler } from "express";
import { AppError } from "../../errors/app-error";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
	if (err instanceof AppError) {
		return res.status(err.statusCode).json({
			error: {
				code: err.code,
				message: err.message,
			},
		});
	}
	console.log(err.code, err.message);

	return res.status(500).json({
		error: {
			code: err.code,
			message: err.message,
		},
	});
};
