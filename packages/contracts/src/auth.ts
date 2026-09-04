import { z } from "zod";
import {
	bioSchema,
	emailSchema,
	okResponseSchema,
	passwordSchema,
	refreshTokenSchema,
	safeString,
	tokenSchema,
} from "./shared";

// ─── Login ─────────────────────────────────────────────────────────

export const loginRequestSchema = z.object({
	identifier: safeString(100, 4),
	password: passwordSchema,
});

export const loginResponseSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	user: z.object({
		id: z.uuid(),
		identifier: z.string().min(1),
	}),
});

export type LoginRequestType = z.infer<typeof loginRequestSchema>;
export type LoginResponseType = z.infer<typeof loginResponseSchema>;

// ─── Two-factor authentication (email OTP) ─────────────────────────

/** A 6-digit one-time code, as typed by the user. */
export const otpCodeSchema = z
	.string()
	.trim()
	.regex(/^\d{6}$/, "Enter the 6-digit code");

/**
 * When the account has 2FA on, `POST /auth/login` returns this instead of
 * tokens: a code has been emailed, and `challengeId` must be replayed to
 * `POST /auth/login/verify-2fa` alongside the code.
 */
export const loginChallengeResponseSchema = z.object({
	twoFactorRequired: z.literal(true),
	challengeId: z.string().min(1),
	message: z.string(),
});

export type LoginChallengeResponseType = z.infer<
	typeof loginChallengeResponseSchema
>;

/** `POST /auth/login` may resolve to either tokens or a 2FA challenge. */
export type LoginOutcomeType = LoginResponseType | LoginChallengeResponseType;

export const verifyTwoFactorLoginRequestSchema = z.object({
	challengeId: z.string().min(1),
	code: otpCodeSchema,
});

export type VerifyTwoFactorLoginRequestType = z.infer<
	typeof verifyTwoFactorLoginRequestSchema
>;

export const verifyTwoFactorLoginResponseSchema = loginResponseSchema;

export const resendTwoFactorLoginRequestSchema = z.object({
	challengeId: z.string().min(1),
});

export type ResendTwoFactorLoginRequestType = z.infer<
	typeof resendTwoFactorLoginRequestSchema
>;

export const resendTwoFactorLoginResponseSchema = okResponseSchema;

export type ResendTwoFactorLoginResponseType = z.infer<
	typeof resendTwoFactorLoginResponseSchema
>;

/** Reports the 2FA flag after an enable/disable action. */
export const twoFactorStatusResponseSchema = z.object({
	twoFactorEnabled: z.boolean(),
	message: z.string(),
});

export type TwoFactorStatusResponseType = z.infer<
	typeof twoFactorStatusResponseSchema
>;

/** `POST /auth/2fa/setup` — emails a code so the user can turn 2FA on. */
export const setupTwoFactorResponseSchema = okResponseSchema;

export type SetupTwoFactorResponseType = z.infer<
	typeof setupTwoFactorResponseSchema
>;

export const enableTwoFactorRequestSchema = z.object({
	code: otpCodeSchema,
});

export type EnableTwoFactorRequestType = z.infer<
	typeof enableTwoFactorRequestSchema
>;

// ─── Signup ────────────────────────────────────────────────────────

export const signUpRequestSchema = z.object({
	username: safeString(30, 4),
	email: emailSchema,
	password: passwordSchema,
	firstname: safeString(100, 1),
	lastname: safeString(100, 1),
	displayname: safeString(100, 1),
	bio: bioSchema.optional(),
	avatarUrl: safeString(150).optional(),
	avatarToken: z.string().uuid().optional(),
});

export const avatarUploadResponseSchema = z.object({
	avatarToken: z.uuid(),
});

export type AvatarUploadResponseType = z.infer<
	typeof avatarUploadResponseSchema
>;

export const signUpResponseSchema = okResponseSchema;

export type SignUpRequestType = z.infer<typeof signUpRequestSchema>;
export type SignUpResponseType = z.infer<typeof signUpResponseSchema>;

// ─── Email verification ────────────────────────────────────────────

export const verifyEmailRequestSchema = z.object({
	token: tokenSchema("Verification token"),
});

export const verifyEmailResponseSchema = okResponseSchema;

export type VerifyEmailRequestType = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyEmailResponseType = z.infer<typeof verifyEmailResponseSchema>;

export const resendVerificationRequestSchema = z.object({
	email: emailSchema,
});

export const resendVerificationResponseSchema = okResponseSchema;

export type ResendVerificationRequestType = z.infer<
	typeof resendVerificationRequestSchema
>;
export type ResendVerificationResponseType = z.infer<
	typeof resendVerificationResponseSchema
>;

// ─── Password operations ───────────────────────────────────────────

export const changePasswordRequestSchema = z.object({
	currentPassword: safeString(128, 1),
	newPassword: passwordSchema,
});

export const changePasswordResponseSchema = okResponseSchema;

export type ChangePasswordRequestType = z.infer<
	typeof changePasswordRequestSchema
>;

export type ChangePasswordResponseType = z.infer<
	typeof changePasswordResponseSchema
>;

export const forgotPasswordRequestSchema = z.object({
	email: emailSchema,
});

export const forgotPasswordResponseSchema = okResponseSchema;

export type ForgotPasswordRequestType = z.infer<
	typeof forgotPasswordRequestSchema
>;

export type ForgotPasswordResponseType = z.infer<
	typeof forgotPasswordResponseSchema
>;

export const resetPasswordBodySchema = z.object({
	newPassword: passwordSchema,
});

export const resetPasswordQuerySchema = z.object({
	token: tokenSchema("Reset token"),
});

export type ResetPasswordQueryType = z.infer<typeof resetPasswordQuerySchema>;
export type ResetPasswordBodyType = z.infer<typeof resetPasswordBodySchema>;

export const resetPasswordRequestSchema = resetPasswordBodySchema.extend({
	token: tokenSchema("Reset token"),
});

export const resetPasswordResponseSchema = okResponseSchema;

export type ResetPasswordRequestType = z.infer<
	typeof resetPasswordRequestSchema
>;

export type ResetPasswordResponseType = z.infer<
	typeof resetPasswordResponseSchema
>;

// ─── Token operations ──────────────────────────────────────────────

export const refreshTokenRequestSchema = z.object({
	refreshToken: refreshTokenSchema,
});

export const refreshTokenResponseSchema = z.object({
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1),
});

export type RefreshTokenRequestType = z.infer<typeof refreshTokenRequestSchema>;
export type RefreshTokenResponseType = z.infer<
	typeof refreshTokenResponseSchema
>;

export const logoutRequestSchema = z.object({
	refreshToken: refreshTokenSchema.optional(),
});

export const logoutResponseSchema = okResponseSchema;

export type LogoutRequestType = z.infer<typeof logoutRequestSchema>;
export type LogoutResponseType = z.infer<typeof logoutResponseSchema>;
