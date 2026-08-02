import { Router } from "express";
import { authController } from "../services/service.container";
const router = Router();

router.post("/signup", authController.signUp);
router.post("/login", authController.login);
router.post("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.post("/change-password", authController.changePassword);

// POST   /api/auth/forgot-password
router.post("/forgot-password", authController.forgotPassword);

// POST   /api/auth/reset-password
router.post("/reset-password/:token", authController.resetPassword);

// POST   /api/auth/logout
// POST   /api/auth/refresh-token

export default router;
