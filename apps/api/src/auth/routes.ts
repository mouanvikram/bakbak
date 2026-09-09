import { Router } from "express";
import { authController } from "../services/service.container";
import { validate } from "../middleware/validate";
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
import { avatarUpload } from "../middleware/file-upload";
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
	avatarUpload.middleware,
	avatarUpload.errorHandler,
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
	rateLimitAuthorized("email"),
	authController.setupTwoFactor,
);
router.post(
	"/2fa/enable",
	authMiddleware,
	validate(enableTwoFactorRequestSchema),
	authController.enableTwoFactor,
);
router.post(
	"/2fa/disable",
	authMiddleware,
	validate(disableTwoFactorRequestSchema),
	authController.disableTwoFactor,
);

// Active sessions / devices (all require a live session).
router.post(
	"/sessions",
	authMiddleware,
	validate(listSessionsRequestSchema),
	authController.listSessions,
);
router.post(
	"/sessions/revoke",
	authMiddleware,
	validate(revokeSessionRequestSchema),
	authController.revokeSession,
);
router.post(
	"/sessions/revoke-others",
	authMiddleware,
	validate(revokeOtherSessionsRequestSchema),
	authController.revokeOtherSessions,
);
router.post(
	"/sessions/revoke-all",
	authMiddleware,
	validate(revokeOtherSessionsRequestSchema),
	authController.revokeAllSessions,
);

export default router;
