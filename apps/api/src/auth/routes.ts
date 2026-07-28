import { Router } from "express";
import {
  login,
  verifyEmail,
  changePassword,
  resendVerification,
  AuthController,
} from "./controller";

const router = Router();
const authController = new AuthController();

router.post("/signup", authController.signUp);
router.post("/login", authController.login);

router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

router.post("/change-password", changePassword);

// POST   /api/auth/forgot-password
// POST   /api/auth/reset-password

// POST   /api/auth/logout
// POST   /api/auth/refresh-token

// GET    /api/auth/me

export default router;
