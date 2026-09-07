import { Router } from "express";
import { authController } from "../services/service.container";
import { validate, validateUserId } from "../middleware/validate";
import {
	changePasswordRequestSchema,
	disableTwoFactorRequestSchema,
	enableTwoFactorRequestSchema,
	forgotPasswordRequestSchema,
	listSessionsRequestSchema,
	loginRequestSchema,
	logoutRequestSchema,
	refreshTokenRequestSchema,
	resendTwoFactorLoginRequestSchema,
	resendVerificationRequestSchema,
	resetPasswordRequestSchema,
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
import {
	rateLimitAuthorized,
	rateLimitEmails,
	rateLimitIp,
} from "../redis/rate-limit";


const router = Router();

// The avatar (optional) is sent as multipart alongside the signup fields, so
// multer has to parse the body before validation sees it. A plain JSON signup
// passes straight through.
router.post(
	"/signup",
	rateLimitEmails(),
	avatarUploadMiddleware,
	avatarMulterErrorHandler,
	validate(signUpRequestSchema),
	authController.signUp,
);
router.post(
	"/login",
	validate(loginRequestSchema),
	rateLimitIp("login"),
	authController.login,
);
router.post(
	"/login/verify-2fa",
	validate(verifyTwoFactorLoginRequestSchema),
	rateLimitIp("login"),
	authController.verifyTwoFactorLogin,
);
router.post(
	"/login/resend-2fa",
	validate(resendTwoFactorLoginRequestSchema),
	rateLimitEmails(),
	authController.resendTwoFactorLogin,
);
router.post(
	"/verify-email",
	validate(verifyEmailRequestSchema),
	authController.verifyEmail,
);
router.post(
	"/resend-verification",
	validate(resendVerificationRequestSchema),
	rateLimitEmails(),
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
	rateLimitEmails(),
	authController.forgotPassword,
);

router.post(
	"/reset-password",
	validate(resetPasswordRequestSchema),
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
	rateLimitAuthorized("email"),
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
	validate(disableTwoFactorRequestSchema),
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
