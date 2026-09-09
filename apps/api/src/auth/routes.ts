import { Router } from "express";
import { authController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import {
  changePasswordRequestSchema,
  disableTwoFactorRequestSchema,
  enableTwoFactorRequestSchema,
  forgotPasswordRequestSchema,
  listSessionsRequestSchema,
  loginRequestSchema,
  logoutRequestSchema,
  refreshTokenRequestSchema,
  resendTwoFactorLoginRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  revokeOtherSessionsRequestSchema,
  revokeSessionRequestSchema,
  signUpRequestSchema,
  verifyEmailRequestSchema,
  verifyTwoFactorLoginRequestSchema,
} from "@bakbak/contracts";
import { authMiddleware } from "@/middleware/auth.middleware";
import { avatarUpload } from "@/middleware/file-upload";
import {
  rateLimitAuthorized,
  rateLimitEmails,
  rateLimitIp,
} from "@/redis/rate-limit";

export const authRoutes = Router();

// The avatar (optional) is sent as multipart alongside the signup fields, so
// multer has to parse the body before validation sees it. A plain JSON signup
// passes straight through.
authRoutes.post(
  "/signup",
  rateLimitEmails(),
  avatarUpload.middleware,
  avatarUpload.errorHandler,
  validate(signUpRequestSchema),
  authController.signUp,
);
authRoutes.post(
  "/login",
  validate(loginRequestSchema),
  rateLimitIp("login"),
  authController.login,
);
authRoutes.post(
  "/login/verify-2fa",
  validate(verifyTwoFactorLoginRequestSchema),
  rateLimitIp("login"),
  authController.verifyTwoFactorLogin,
);
authRoutes.post(
  "/login/resend-2fa",
  validate(resendTwoFactorLoginRequestSchema),
  rateLimitEmails(),
  authController.resendTwoFactorLogin,
);
authRoutes.post(
  "/verify-email",
  validate(verifyEmailRequestSchema),
  authController.verifyEmail,
);
authRoutes.post(
  "/resend-verification",
  validate(resendVerificationRequestSchema),
  rateLimitEmails(),
  authController.resendVerification,
);
authRoutes.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordRequestSchema),
  authController.changePassword,
);

authRoutes.post(
  "/forgot-password",
  validate(forgotPasswordRequestSchema),
  rateLimitEmails(),
  authController.forgotPassword,
);

authRoutes.post(
  "/reset-password",
  validate(resetPasswordRequestSchema),
  authController.resetPassword,
);

authRoutes.post(
  "/logout",
  authMiddleware,
  validate(logoutRequestSchema),
  authController.logout,
);
authRoutes.post(
  "/refresh-token",
  validate(refreshTokenRequestSchema),
  authController.refreshToken,
);

// Two-factor management (all require a live session).
authRoutes.post(
  "/2fa/setup",
  authMiddleware,
  rateLimitAuthorized("email"),
  authController.setupTwoFactor,
);
authRoutes.post(
  "/2fa/enable",
  authMiddleware,
  validate(enableTwoFactorRequestSchema),
  authController.enableTwoFactor,
);
authRoutes.post(
  "/2fa/disable",
  authMiddleware,
  validate(disableTwoFactorRequestSchema),
  authController.disableTwoFactor,
);

// Active sessions / devices (all require a live session).
authRoutes.post(
  "/sessions",
  authMiddleware,
  validate(listSessionsRequestSchema),
  authController.listSessions,
);
authRoutes.post(
  "/sessions/revoke",
  authMiddleware,
  validate(revokeSessionRequestSchema),
  authController.revokeSession,
);
authRoutes.post(
  "/sessions/revoke-others",
  authMiddleware,
  validate(revokeOtherSessionsRequestSchema),
  authController.revokeOtherSessions,
);
authRoutes.post(
  "/sessions/revoke-all",
  authMiddleware,
  validate(revokeOtherSessionsRequestSchema),
  authController.revokeAllSessions,
);
