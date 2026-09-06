import { Router } from "express";
import { authController } from "../services/service.container";
import { validate, validateUserId } from "../middleware/validate";
import {
	changePasswordRequestSchema,
	enableTwoFactorRequestSchema,
	forgotPasswordRequestSchema,
	listSessionsRequestSchema,
	loginRequestSchema,
	logoutRequestSchema,
	refreshTokenRequestSchema,
	resendTwoFactorLoginRequestSchema,
	resendVerificationRequestSchema,
	resetPasswordBodySchema,
	resetPasswordQuerySchema,
	revokeOtherSessionsRequestSchema,
	revokeSessionRequestSchema,
	signUpRequestSchema,
	verifyEmailRequestSchema,
	verifyTwoFactorLoginRequestSchema,
} from "@bakbak/contracts";
import { authMiddleware } from "../middleware/auth.middleware";
import {
	avatarMulterErrorHandler,
	avatarUploadMiddleware,
} from "../middleware/avatar.middleware";

const router = Router();

// The avatar (optional) is sent as multipart alongside the signup fields, so
// multer has to parse the body before validation sees it. A plain JSON signup
// passes straight through.
router.post(
	"/signup",
	avatarUploadMiddleware,
	avatarMulterErrorHandler,
	validate(signUpRequestSchema),
	authController.signUp,
);
router.post("/login", validate(loginRequestSchema), authController.login);
router.post(
	"/login/verify-2fa",
	validate(verifyTwoFactorLoginRequestSchema),
	authController.verifyTwoFactorLogin,
);
router.post(
	"/login/resend-2fa",
	validate(resendTwoFactorLoginRequestSchema),
	authController.resendTwoFactorLogin,
);
router.post(
	"/verify-email",
	validate(verifyEmailRequestSchema, "query"),
	authController.verifyEmail,
);
router.post(
	"/resend-verification",
	validate(resendVerificationRequestSchema),
	authController.resendVerification,
);
router.post(
	"/change-password",
	authMiddleware,
	validateUserId(),
	validate(changePasswordRequestSchema),
	authController.changePassword,
);

router.post(
	"/forgot-password",
	validate(forgotPasswordRequestSchema),
	authController.forgotPassword,
);

router.post(
	"/reset-password",
	validate(resetPasswordQuerySchema, "query"),
	validate(resetPasswordBodySchema),
	authController.resetPassword,
);

router.post(
	"/logout",
	authMiddleware,
	validateUserId(),
	validate(logoutRequestSchema),
	authController.logout,
);
router.post(
	"/refresh-token",
	validate(refreshTokenRequestSchema),
	authController.refreshToken,
);

// Two-factor management (all require a live session).
router.post(
	"/2fa/setup",
	authMiddleware,
	validateUserId(),
	authController.setupTwoFactor,
);
router.post(
	"/2fa/enable",
	authMiddleware,
	validateUserId(),
	validate(enableTwoFactorRequestSchema),
	authController.enableTwoFactor,
);
router.post(
	"/2fa/disable",
	authMiddleware,
	validateUserId(),
	authController.disableTwoFactor,
);

// Active sessions / devices (all require a live session).
router.post(
	"/sessions",
	authMiddleware,
	validateUserId(),
	validate(listSessionsRequestSchema),
	authController.listSessions,
);
router.post(
	"/sessions/revoke",
	authMiddleware,
	validateUserId(),
	validate(revokeSessionRequestSchema),
	authController.revokeSession,
);
router.post(
	"/sessions/revoke-others",
	authMiddleware,
	validateUserId(),
	validate(revokeOtherSessionsRequestSchema),
	authController.revokeOtherSessions,
);
router.post(
	"/sessions/revoke-all",
	authMiddleware,
	validateUserId(),
	validate(revokeOtherSessionsRequestSchema),
	authController.revokeAllSessions,
);

export default router;
