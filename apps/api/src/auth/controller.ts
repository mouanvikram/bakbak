import { type NextFunction, type Request, type Response } from "express";
import type { AuthService } from "./service";
import {
	verifyEmailResponseSchema,
	loginResponseSchema,
	signUpResponseSchema,
	resendVerificationResponseSchema,
	changePasswordResponseSchema,
	forgotPasswordResponseSchema,
	resetPasswordResponseSchema,
	logoutResponseSchema,
	refreshTokenResponseSchema,
} from "@bakbak/contracts";
import { validateResponse } from "../middleware/validate";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export interface AuthRequest extends Request {
	user?: {
		userId: string;
		username?: string;
		role?: string;
	};
}

export class AuthController {
	constructor(private readonly authService: AuthService) {}

	signUp = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const response = await this.authService.register(req.body);

			return validateResponse(
				res,
				HTTP_STATUS.OK,
				signUpResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	login = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const response = await this.authService.login(req.body);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				loginResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { token } = req.query;
			if (typeof token !== "string" || !token.trim()) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Verification token is required",
				);
			}
			const result = await this.authService.verifyEmail({ token });

			return validateResponse(res, 200, verifyEmailResponseSchema, result);
		} catch (error) {
			next(error);
		}
	};

	resendVerification = async (
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const response = await this.authService.resendVerificationEmail(req.body);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				resendVerificationResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	changePassword = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			if (!req.user) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Authentication required",
				);
			}

			const response = await this.authService.changePassword(
				req.user?.userId,
				req.body,
			);

			return validateResponse(
				res,
				HTTP_STATUS.OK,
				changePasswordResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const response = await this.authService.forgotPassword(req.body);

			return validateResponse(
				res,
				HTTP_STATUS.OK,
				forgotPasswordResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	resetPassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { token } = req.query;
			const newPassword = req.body.newPassword;

			if (typeof token !== "string" || !token.trim()) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid token",
				);
			}

			const response = await this.authService.resetPassword({
				token,
				newPassword,
			});

			return validateResponse(
				res,
				HTTP_STATUS.OK,
				resetPasswordResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Authentication required",
				);
			}

			const result = await this.authService.logout(userId, req.body);

			return validateResponse(
				res,
				HTTP_STATUS.OK,
				logoutResponseSchema,
				result,
			);
		} catch (error) {
			next(error);
		}
	};

	refreshToken = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await this.authService.refreshAccessToken(req.body);

			return validateResponse(
				res,
				HTTP_STATUS.OK,
				refreshTokenResponseSchema,
				result,
			);
		} catch (error) {
			next(error);
		}
	};
}
