import { Router } from "express";
import { AuthController } from "./controller";

const router = Router();
const authController = new AuthController();

router.post("/signup", authController.signUp);
router.post("/login", authController.login);
router.post("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.post("/change-password", authController.changePassword);

// POST   /api/auth/forgot-password
router.post("/forgot-password",authController.forgotPassword);

// POST   /api/auth/reset-password
router.post("/reset-password/:token",authController.resetPassword);

// POST   /api/auth/logout
// POST   /api/auth/refresh-token

// GET    /api/auth/me

export default router;
