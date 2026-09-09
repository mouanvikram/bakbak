import type { AuthRequest } from "@/auth/auth-request";
import type { NextFunction, Response } from "express";
import {
	jwtService,
	refreshTokenRepository,
	userRepository,
} from "@/services/service.container";
import type { AccessTokenPayload } from "@/auth/jwt.service";
import logger from "@/lib/logger";
import { userIdSchema } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

export const authMiddleware = async (
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

		// Reject any other JWT signed with this secret (e.g. a 2FA login
		// challenge) — only a real access token authenticates a request.
		if (payload.typ !== "access" || !payload.sid) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED,
				"Invalid or expired token",
			);
		}

		// `sub` reaches Postgres as a uuid column: assert the shape here so a
		// malformed id fails locally instead of costing a round-trip that
		// comes back as Prisma P2023. Same uniform 401 as every other reason.
		if (!userIdSchema.safeParse({ userId: payload.sub }).success) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED,
				"Invalid or expired token",
			);
		}

		// Stateless JWTs can't revoke themselves: confirm the session is
		// still live and the account isn't soft-deleted. Two indexed PK
		// lookups, resolved in parallel — uniform 401 either way so the
		// response doesn't oracle revoked vs deleted vs unknown.
		const [session, user] = await Promise.all([
			refreshTokenRepository.findSessionById(payload.sid),
			userRepository.findActiveById(payload.sub),
		]);

		if (
			!session ||
			session.revokedAt ||
			session.userId !== payload.sub ||
			!user
		) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED,
				"Invalid or expired token",
			);
		}

		req.user = {
			userId: payload.sub,
			sessionId: payload.sid,
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
