import { z } from "zod";
import {
	BIO_MAX_LENGTH,
	BIO_MIN_LENGTH,
	bioSchema,
	emailSchema,
	okResponseSchema,
	profileSnippetSchema,
	safeString,
	userSummarySchema,
	usernameSchema,
	type UserIdType,
} from "./shared";

export const userProfileSchema = z.object({
	id: z.uuid(),
	email: emailSchema,
	username: safeString(100),
	verified: z.boolean(),
	firstName: safeString(100).nullish(),
	lastName: safeString(100).nullish(),
	bio: safeString(BIO_MAX_LENGTH, BIO_MIN_LENGTH).nullish(),
	avatar: safeString(1024).nullish(),
	displayName: safeString(100).nullish(),
	joinedAt: z.string(),
	friendsCount: z.number().int().nonnegative(),
});

export type UserProfileType = z.infer<typeof userProfileSchema>;

export const userResponseSchema = userProfileSchema;

export const getMeResponseSchema = z.object({
	profile: userProfileSchema,
});

export type GetMeResponseType = z.infer<typeof getMeResponseSchema>;

export const updateProfileRequestSchema = z.object({
	// Same rules as signup (4–30 chars, lowercased); the API also checks it's not taken.
	username: usernameSchema.optional(),
	// `null`/blank clears the bio; a real value must be 10–500 chars.
	bio: bioSchema.optional(),
	firstName: safeString(100).optional(),
	lastName: safeString(100).optional(),
	displayName: safeString(100).optional(),
});

export const updateProfileResponseSchema = userProfileSchema.pick({
	username: true,
	verified: true,
	firstName: true,
	lastName: true,
	bio: true,
	avatar: true,
	displayName: true,
});

export type UpdateProfileRequestType = UserIdType &
	z.infer<typeof updateProfileRequestSchema>;
export type UpdateProfileResponseType = z.infer<
	typeof updateProfileResponseSchema
>;

export const updateAvatarRequestSchema = z.object({
	avatar: safeString(1024),
});

export const updateAvatarResponseSchema = z.object({
	avatar: safeString(1024).nullish(),
});

export type UpdateAvatarRequestType = UserIdType &
	z.infer<typeof updateAvatarRequestSchema>;
export type UpdateAvatarResponseType = z.infer<
	typeof updateAvatarResponseSchema
>;

export const deleteMeResponseSchema = okResponseSchema;

export type DeleteMeResponseType = z.infer<typeof deleteMeResponseSchema>;

export const checkUsernameRequestSchema = z.object({
	username: safeString(30),
});

export const checkUsernameResponseSchema = z.object({
	available: z.boolean(),
});

export type CheckUsernameRequestType = z.infer<
	typeof checkUsernameRequestSchema
>;
export type CheckUsernameResponseType = z.infer<
	typeof checkUsernameResponseSchema
>;

export const searchUserSchema = userSummarySchema.extend({
	profile: profileSnippetSchema.nullish(),
});

export const searchUsersRequestSchema = z.object({
	query: safeString(100),
});

export const searchUsersResponseSchema = z.object({
	users: z.array(searchUserSchema),
});

export type SearchUsersRequestType = z.infer<typeof searchUsersRequestSchema>;
export type SearchUserType = z.infer<typeof searchUserSchema>;
export type SearchUsersResponseType = z.infer<typeof searchUsersResponseSchema>;

export const getProfileRequestSchema = z.object({
	username: safeString(100, 1),
});

/** How the caller is related to the profile they're looking at. */
export const friendshipStatusSchema = z.enum([
	"self",
	"friends",
	"request_sent",
	"request_received",
	"none",
]);

export type FriendshipStatusType = z.infer<typeof friendshipStatusSchema>;

export const getProfileResponseSchema = userProfileSchema
	.pick({
		username: true,
		verified: true,
		firstName: true,
		lastName: true,
		bio: true,
		avatar: true,
		displayName: true,
	})
	.extend({
		id: z.uuid(),
		joinedAt: z.string(),
		friendsCount: z.number().int().nonnegative(),
		friendshipStatus: friendshipStatusSchema,
		/** Id of the pending request between the two users, if any. */
		pendingRequestId: z.uuid().nullish(),
	});

export type GetProfileRequestType = z.infer<typeof getProfileRequestSchema>;
export type GetProfileResponseType = z.infer<typeof getProfileResponseSchema>;
