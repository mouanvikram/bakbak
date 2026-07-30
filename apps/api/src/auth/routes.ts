import { Router } from "express";
import { AuthController } from "./controller";

const router = Router();
const authController = new AuthController();

router.post("/signup", authController.signUp);
router.post("/login", authController.login);

//convert to post method as we are going to need it only while verification.
router.post("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);

router.post("/change-password", authController.changePassword);

// POST   /api/auth/forgot-password
// POST   /api/auth/reset-password

// POST   /api/auth/logout
// POST   /api/auth/refresh-token

// GET    /api/auth/me

export default router;
