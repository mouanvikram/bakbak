import { z } from "zod";

export const loginRequestSchema = z.object({
	identifier: z
		.string()
		.min(4, "Email or username must be at least 4 characters")
		.max(100, "Email or username must be at most 100 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	password: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
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

export const signUpRequestSchema = z.object({
	username: z
		.string()
		.min(4, "Minimum length should be 4")
		.max(30, "Username must be at most 30 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	email: z
		.string()
		.max(100)
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	password: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
	firstname: z
		.string()
		.min(1)
		.max(100)
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	lastname: z
		.string()
		.min(1)
		.max(100)
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	displayname: z
		.string()
		.min(1)
		.max(100)
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	bio: z
		.string()
		.max(500)
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.optional(),
	avatarUrl: z
		.string()
		.max(150)
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.optional(),
});

export const signUpResponseSchema = z.object({
	message: z.string(),
});

export type SignUpRequestType = z.infer<typeof signUpRequestSchema>;
export type SignUpResponseType = z.infer<typeof signUpResponseSchema>;

export const verifyEmailRequestSchema = z.object({
	token: z
		.string()
		.min(1, "Verification token is required")
		.max(100, "Verification token is too long")
		.regex(/[^\x00]/, "Null bytes are not allowed"),
});

export const verifyEmailResponseSchema = z.object({
	message: z.string(),
});

export type VerifyEmailRequestType = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyEmailResponseType = z.infer<typeof verifyEmailResponseSchema>;

export const resendVerificationRequestSchema = z.object({
	email: z.string().email().max(100).regex(/[^\x00]/, "Null bytes are not allowed"),
});

export const resendVerificationResponseSchema = z.object({
	message: z.string(),
});

export type ResendVerificationRequestType = z.infer<
	typeof resendVerificationRequestSchema
>;
export type ResendVerificationResponseType = z.infer<
	typeof resendVerificationResponseSchema
>;

export const changePasswordRequestSchema = z.object({
	currentPassword: z
		.string()
		.min(1)
		.regex(/[^\x00]/, "Null bytes are not allowed"),
	newPassword: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
});

export const changePasswordResponseSchema = z.object({
	message: z.string(),
});
export const userIdSchema = z.object({
	userId: z.uuid(),
});
export type UserIdType = z.infer<typeof userIdSchema>;
export type ChangePasswordRequestType = z.infer<
	typeof changePasswordRequestSchema
>;

export type ChangePasswordResponseType = z.infer<
	typeof changePasswordResponseSchema
>;

export const forgotPasswordRequestSchema = z.object({
	email: z.string().email().max(100).regex(/[^\x00]/, "Null bytes are not allowed"),
});

export const forgotPasswordResponseSchema = z.object({
	message: z.string(),
});

export type ForgotPasswordRequestType = z.infer<
	typeof forgotPasswordRequestSchema
>;

export type ForgotPasswordResponseType = z.infer<
	typeof forgotPasswordResponseSchema
>;

export const resetPasswordRequestSchema = z.object({
	token: z
		.string()
		.min(1, "Reset token is required")
		.max(100, "Reset token is too long")
		.regex(/[^\x00]/, "Null bytes are not allowed"),

	newPassword: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
});

export const resetPasswordBodySchema = z.object({
	newPassword: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
});

export const resetPasswordResponseSchema = z.object({
	message: z.string(),
});

export type ResetPasswordRequestType = z.infer<
	typeof resetPasswordRequestSchema
>;

export type ResetPasswordResponseType = z.infer<
	typeof resetPasswordResponseSchema
>;

export const refreshTokenRequestSchema = z.object({
	refreshToken: z
		.string()
		.min(1, "Refresh token is required")
		.max(255, "Refresh token is too long")
		.regex(/[^\x00]/, "Null bytes are not allowed"),
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
	refreshToken: z
		.string()
		.max(255, "Refresh token is too long")
		.regex(/[^\x00]/, "Null bytes are not allowed")
		.optional(),
});

export const logoutResponseSchema = z.object({
	message: z.string(),
});

export type LogoutRequestType = z.infer<typeof logoutRequestSchema>;
export type LogoutResponseType = z.infer<typeof logoutResponseSchema>;
