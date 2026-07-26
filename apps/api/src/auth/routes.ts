import { Router } from "express";
import {
    signUp,
    login,
    verifyEmail,
    changePassword,
    resendVerification,
} from "./controller";

const router = Router();


router.post("/signup", signUp);
router.post("/login", login);

router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

router.post("/change-password", changePassword);

// POST   /api/auth/forgot-password
// POST   /api/auth/reset-password

// POST   /api/auth/logout
// POST   /api/auth/refresh-token

// GET    /api/auth/me


export default router;