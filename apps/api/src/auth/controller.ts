import {
	response,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import type { AuthService } from "./service";
import {
	verifyEmailResponseSchema,
	loginResponseSchema,
	signUpResponseSchema,
	type LoginResponseType,
	type SignUpResponseType,
	resendVerificationResponseSchema,
	changePasswordResponseSchema,
	forgotPasswordResponseSchema,
	resetPasswordResponseSchema,
} from "@bakbak/contracts";
import { validate, validateResponse } from "../middleware/validate";
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
				return res.status(400).json({
					message: "Verification token is required",
				});
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

			if (typeof token !== "string") {
				return res.status(400).json({
					message: "Invalid token",
				});
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

	logout = async (req: Request, res: Response, next: NextFunction) => {};

	refreshToken = async (req: Request, res: Response, next: NextFunction) => {};
}
