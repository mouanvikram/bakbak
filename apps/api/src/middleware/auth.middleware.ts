import type { AuthRequest } from "../auth/controller";
import type { NextFunction, Response } from "express";
import { jwtService } from "../services/service.container";
import type { AccessTokenPayload } from "../helpers/jwt.service";
import logger from "@/lib/logger";
import { userIdSchema } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

export const authMiddleware = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const authHeaders = req.headers.authorization;

		if (!authHeaders || !authHeaders.startsWith("Bearer ")) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED,
				"Invalid request",
			);
		}
		const token = authHeaders.split(" ")[1];
		if (!token) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.UNAUTHORIZED,
				"Missing token",
			);
		}

		const payload = jwtService.verifyJwt<AccessTokenPayload>(token);

		req.user = {
			userId: payload.sub,
		};

		next();
	} catch (error) {
		if (error instanceof AppError) {
			return res.status(error.statusCode).json({
				error: {
					code: error.code,
					message: error.message,
				},
			});
		}

		return res.status(HTTP_STATUS.UNAUTHORIZED).json({
			error: {
				code: ERROR_CODES.UNAUTHORIZED,
				message: "Invalid or expired token",
			},
		});
	}
};
