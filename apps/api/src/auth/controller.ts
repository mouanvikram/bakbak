import { type NextFunction, type Request, type Response } from "express";
import type { AuthService } from "./service";
import {
	verifyEmailResponseSchema,
	loginResponseSchema,
	loginChallengeResponseSchema,
	signUpResponseSchema,
	resendVerificationResponseSchema,
	changePasswordResponseSchema,
	forgotPasswordResponseSchema,
	resetPasswordResponseSchema,
	logoutResponseSchema,
	refreshTokenResponseSchema,
	verifyTwoFactorLoginResponseSchema,
	resendTwoFactorLoginResponseSchema,
	setupTwoFactorResponseSchema,
	twoFactorStatusResponseSchema,
	listSessionsResponseSchema,
	revokeSessionResponseSchema,
} from "@bakbak/contracts";
import type {
	ResetPasswordBodyType,
	ResetPasswordQueryType,
	SignUpRequestType,
	VerifyEmailRequestType,
	VerifyTwoFactorLoginRequestType,
	ResendTwoFactorLoginRequestType,
	EnableTwoFactorRequestType,
	ListSessionsRequestType,
	RevokeSessionRequestType,
	RevokeOtherSessionsRequestType,
} from "@bakbak/contracts";
import { validateResponse } from "../middleware/validate";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

export interface AuthRequest extends Request {
	user?: {
		userId: string;
		username?: string;
		role?: string;
		sessionId?: string;
	};
}

export class AuthController {
	constructor(private readonly authService: AuthService) {}

	signUp = async (req: Request, res: Response, next: NextFunction) => {
		try {
			//bio if left blank will be null. matches db schema.
			// An avatar, when sent, arrives as multipart alongside the fields.
			const response = await this.authService.register(
				req.valid?.body as SignUpRequestType,
				req.file,
			);

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
			const response = await this.authService.login(
				req.body,
				req.headers["user-agent"],
			);

			// 2FA on → a challenge instead of tokens (still a 200).
			if ("twoFactorRequired" in response) {
				return validateResponse(
					res,
					HTTP_STATUS.OK,
					loginChallengeResponseSchema,
					response,
				);
			}

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

	verifyTwoFactorLogin = async (
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const response = await this.authService.verifyLoginTwoFactor(
				req.valid?.body as VerifyTwoFactorLoginRequestType,
				req.headers["user-agent"],
			);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				verifyTwoFactorLoginResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	resendTwoFactorLogin = async (
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const response = await this.authService.resendLoginTwoFactor(
				req.valid?.body as ResendTwoFactorLoginRequestType,
			);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				resendTwoFactorLoginResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	setupTwoFactor = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Authentication required",
				);
			}
			const response = await this.authService.requestTwoFactorSetup(userId);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				setupTwoFactorResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	enableTwoFactor = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Authentication required",
				);
			}
			const response = await this.authService.enableTwoFactor(
				userId,
				req.valid?.body as EnableTwoFactorRequestType,
			);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				twoFactorStatusResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	disableTwoFactor = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Authentication required",
				);
			}
			const response = await this.authService.disableTwoFactor(userId);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				twoFactorStatusResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { token } = req.valid?.query as VerifyEmailRequestType;
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
			const { token } = req.valid?.query as ResetPasswordQueryType;
			const { newPassword } = req.valid?.body as ResetPasswordBodyType;

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

	listSessions = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = this.requireUser(req);
			const { refreshToken } = req.valid?.body as ListSessionsRequestType;
			const result = await this.authService.listSessions(userId, {
				sessionId: req.user?.sessionId,
				refreshToken,
			});
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				listSessionsResponseSchema,
				result,
			);
		} catch (error) {
			next(error);
		}
	};

	revokeSession = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = this.requireUser(req);
			const { sessionId } = req.valid?.body as RevokeSessionRequestType;
			const result = await this.authService.revokeSession(userId, sessionId);
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				revokeSessionResponseSchema,
				result,
			);
		} catch (error) {
			next(error);
		}
	};

	revokeOtherSessions = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = this.requireUser(req);
			const { refreshToken } = req.valid
				?.body as RevokeOtherSessionsRequestType;
			const result = await this.authService.revokeOtherSessions(userId, {
				sessionId: req.user?.sessionId,
				refreshToken,
			});
			return validateResponse(
				res,
				HTTP_STATUS.OK,
				revokeSessionResponseSchema,
				result,
			);
		} catch (error) {
			next(error);
		}
	};

	private requireUser(req: AuthRequest): string {
		const userId = req.user?.userId;
		if (!userId) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED,
				"Authentication required",
			);
		}
		return userId;
	}
}
