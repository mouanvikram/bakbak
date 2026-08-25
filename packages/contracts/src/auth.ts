import { z } from "zod";
import {
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

// ─── Signup ────────────────────────────────────────────────────────

export const signUpRequestSchema = z.object({
	username: safeString(30, 4),
	email: emailSchema,
	password: passwordSchema,
	firstname: safeString(100, 1),
	lastname: safeString(100, 1),
	displayname: safeString(100, 1),
	bio: safeString(500).optional(),
	avatarUrl: safeString(150).optional(),
});

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
