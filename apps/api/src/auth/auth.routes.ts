import { Router } from "express";
import {
    signUp,
    login,
    verifyEmail,
    resetPassword,
    resendVerification,
} from "./auth.controller";

const router = Router();

router.post("/signup", signUp);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/reset-password", resetPassword);
router.post("/resend-verification", resendVerification);

export default router;