import { Router } from "express";
import { authController } from "../services/service.container";
import { validate, validateUserId } from "../middleware/validate";
import {
	changePasswordRequestSchema,
	forgotPasswordRequestSchema,
	loginRequestSchema,
	logoutRequestSchema,
	refreshTokenRequestSchema,
	resendVerificationRequestSchema,
	resetPasswordBodySchema,
	signUpRequestSchema,
	verifyEmailRequestSchema,
} from "@bakbak/contracts";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", validate(signUpRequestSchema), authController.signUp);
router.post("/login", validate(loginRequestSchema), authController.login);
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

export default router;
