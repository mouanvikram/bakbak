import { z } from "zod";

export const safeString = (max: number, min = 1) =>
	z
		.string()
		.min(min)
		.max(max)
		.regex(/^(?!.*\0)/, "Null bytes are not allowed");

// Username is canonically lowercase (matches the citext column, which is the
// backstop — this is what actually keeps stored values consistent).
export const usernameSchema = safeString(30, 4).trim().toLowerCase();

export const emailSchema = z.email().max(100).trim().toLowerCase();

/** Smallest bio we'll store — anything shorter (once trimmed) isn't worth keeping. */
export const BIO_MIN_LENGTH = 10;
export const BIO_MAX_LENGTH = 500;

/**
 * A user bio for write paths (signup, profile update). A bio is either absent —
 * `null`, `undefined`, or blank/whitespace, all normalised to `null` — or a real
 * string of {@link BIO_MIN_LENGTH}–{@link BIO_MAX_LENGTH} characters after
 * trimming. Empty strings are never persisted.
 */
export const bioSchema = z
	.string()
	.max(BIO_MAX_LENGTH, `Bio must be ${BIO_MAX_LENGTH} characters or fewer`)
	.regex(/^(?!.*\0)/, "Null bytes are not allowed")
	.nullable()
	.transform((value) => {
		const trimmed = value?.trim() ?? "";
		return trimmed.length === 0 ? null : trimmed;
	})
	.refine((value) => value === null || value.length >= BIO_MIN_LENGTH, {
		message: `Bio must be at least ${BIO_MIN_LENGTH} characters`,
	});

export const passwordSchema = safeString(128, 12)
	.regex(/[A-Z]/, "Password must contain an uppercase letter")
	.regex(/[a-z]/, "Password must contain a lowercase letter")
	.regex(/[0-9]/, "Password must contain a number")
	.regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const tokenSchema = (name: string) =>
	z
		.string()
		.min(1, `${name} is required`)
		.max(100, `${name} is too long`)
		.regex(/^(?!.*\0)/, "Null bytes are not allowed");

export const refreshTokenSchema = z
	.string()
	.min(1, "Refresh token is required")
	.max(255, "Refresh token is too long")
	.regex(/^(?!.*\0)/, "Null bytes are not allowed");

export const okResponseSchema = z.object({
	message: z.string(),
});

export const userIdSchema = z.object({
	userId: z.uuid(),
});

export type UserIdType = z.infer<typeof userIdSchema>;

export const profileSnippetSchema = z.object({
	displayName: z.string().nullish(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	avatar: safeString(1024).nullish(),
	bio: z.string().nullish(),
});

export const profileCoreSchema = z.object({
	displayName: z.string().nullish(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	avatar: safeString(1024).nullish(),
});

export const userSummarySchema = z.object({
	id: z.uuid(),
	username: z.string(),
	profile: profileSnippetSchema.nullish(),
});

export type UserSummaryType = z.infer<typeof userSummarySchema>;

export const uuidParam = (name: string) => z.object({ [name]: z.uuid() });

export const arrayResponseSchema = <T extends z.ZodTypeAny>(
	name: string,
	items: T,
) => z.object({ [name]: z.array(items) });

export const singleItemResponseSchema = <T extends z.ZodTypeAny>(
	name: string,
	item: T,
) => z.object({ [name]: item });

export const MessageType = {
	TEXT: "TEXT",
	IMAGE: "IMAGE",
	VIDEO: "VIDEO",
	AUDIO: "AUDIO",
	FILE: "FILE",
	STICKER: "STICKER",
	LOCATION: "LOCATION",
	CONTACT: "CONTACT",
	CALL: "CALL",
	SYSTEM: "SYSTEM",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const messageTypeSchema = z.enum([
	"TEXT",
	"IMAGE",
	"VIDEO",
	"AUDIO",
	"FILE",
	"STICKER",
	"LOCATION",
	"CONTACT",
	"CALL",
	"SYSTEM",
]);
