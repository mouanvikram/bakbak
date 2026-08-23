import { Router } from "express";
import { authController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	changePasswordRequestSchema,
	forgotPasswordRequestSchema,
	loginRequestSchema,
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
	validate(changePasswordRequestSchema),
	authMiddleware,
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

router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);

export default router;
