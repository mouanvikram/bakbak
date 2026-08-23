import { z } from "zod";

// login request and response
export const loginRequestSchema = z.object({
	identifier: z
		.string()
		.min(4, "Email or username must be at least 4 characters"),
	password: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
});

export const loginResponseSchema = z.object({
	accessToken: z.string(),
	user: z.object({
		id: z.uuid(),
		identifier: z.string().min(1),
	}),
});

export type LoginRequestType = z.infer<typeof loginRequestSchema>;
export type LoginResponseType = z.infer<typeof loginResponseSchema>;

// signup request and response

export const signUpRequestSchema = z.object({
	username: z.string().min(4, "Minimum length should be 4"),
	email: z.email(),
	password: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
		.regex(/[A-Z]/, "Password must contain an uppercase letter")
		.regex(/[a-z]/, "Password must contain a lowercase letter")
		.regex(/[0-9]/, "Password must contain a number")
		.regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
	firstname: z.string().min(1),
	lastname: z.string().min(1),
	displayname: z.string().min(1),
	bio: z.string().optional(),
	avatarUrl: z.string().optional(),
});

export const signUpResponseSchema = z.object({
	message: z.string(),
});

export type SignUpRequestType = z.infer<typeof signUpRequestSchema>;
export type SignUpResponseType = z.infer<typeof signUpResponseSchema>;

// verify-email
export const verifyEmailRequestSchema = z.object({
	token: z.string().min(1, "Verification token is required"),
});

export const verifyEmailResponseSchema = z.object({
	message: z.string(),
});

export type VerifyEmailRequestType = z.infer<typeof verifyEmailRequestSchema>;
export type VerifyEmailResponseType = z.infer<typeof verifyEmailResponseSchema>;

// resend-verification

export const resendVerificationRequestSchema = z.object({
	email: z.email(),
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

// change-password

export const changePasswordRequestSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
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

// forgot-password
export const forgotPasswordRequestSchema = z.object({
	email: z.email(),
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

// reset-password
export const resetPasswordRequestSchema = z.object({
	token: z.string().min(1, "Reset token is required"),

	newPassword: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be at most 128 characters")
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

// refresh-token
export const refreshTokenResponseSchema = z.object({
	accessToken: z.string().min(1),
});

export type RefreshTokenResponseType = z.infer<
	typeof refreshTokenResponseSchema
>;

// logout

export const logoutResponseSchema = z.object({
	message: z.string(),
});

export type LogoutResponseType = z.infer<typeof logoutResponseSchema>;
