import { Router } from "express";
import {
    signUp,
    login,
    verifyEmail,
    changePassword,
    resendVerification,
} from "./controller";

const router = Router();




// POST   /api/auth/signup
// POST   /api/auth/login
router.post("/signup", signUp);
router.post("/login", login);

// GET    /api/auth/verify-email
// POST   /api/auth/resend-verification
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// POST   /api/auth/change-password
router.post("/change-password", changePassword);

// POST   /api/auth/forgot-password
// POST   /api/auth/reset-password

// POST   /api/auth/logout
// POST   /api/auth/refresh-token

// GET    /api/auth/me


export default router;