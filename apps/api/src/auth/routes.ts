import { Router } from "express";
import { authController } from "../services/service.container";
import { validate, validateUserId } from "../middleware/validate";
import {
	changePasswordRequestSchema,
	enableTwoFactorRequestSchema,
	forgotPasswordRequestSchema,
	loginRequestSchema,
	logoutRequestSchema,
	refreshTokenRequestSchema,
	resendTwoFactorLoginRequestSchema,
	resendVerificationRequestSchema,
	resetPasswordBodySchema,
	resetPasswordQuerySchema,
	signUpRequestSchema,
	verifyEmailRequestSchema,
	verifyTwoFactorLoginRequestSchema,
} from "@bakbak/contracts";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", validate(signUpRequestSchema), authController.signUp);
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

export default router;
