import { z } from "zod";
import {
	okResponseSchema,
	profileSnippetSchema,
	safeString,
	userSummarySchema,
	userIdSchema,
	type UserIdType,
} from "./shared";

export const userProfileSchema = z.object({
	id: z.uuid(),
	email: z.string().email().max(100),
	username: z.string(),
	verified: z.boolean(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	bio: z.string().nullish(),
	avatar: z.string().nullish(),
	displayName: z.string().nullish(),
});

export type UserProfileType = z.infer<typeof userProfileSchema>;

export const userResponseSchema = userProfileSchema;

export const getMeResponseSchema = z.object({
	profile: userProfileSchema,
});

export type GetMeResponseType = z.infer<typeof getMeResponseSchema>;

export const updateProfileRequestSchema = z.object({
	bio: safeString(500).optional(),
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
	avatar: z.string(),
});

export const updateAvatarResponseSchema = z.object({
	avatar: z.string().nullish(),
});

export type UpdateAvatarRequestType = UserIdType &
	z.infer<typeof updateAvatarRequestSchema>;
export type UpdateAvatarResponseType = z.infer<
	typeof updateAvatarResponseSchema
>;

export const deleteMeResponseSchema = okResponseSchema;

export type DeleteMeResponseType = z.infer<typeof deleteMeResponseSchema>;

export const checkUsernameRequestSchema = z.object({
	username: z.string().min(1),
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
	query: z.string(),
});

export const searchUsersResponseSchema = z.object({
	users: z.array(searchUserSchema),
});

export type SearchUsersRequestType = z.infer<typeof searchUsersRequestSchema>;
export type SearchUserType = z.infer<typeof searchUserSchema>;
export type SearchUsersResponseType = z.infer<typeof searchUsersResponseSchema>;

export const getProfileRequestSchema = z.object({
	username: z.string().min(1),
});

export const getProfileResponseSchema = userProfileSchema.pick({
	username: true,
	verified: true,
	firstName: true,
	lastName: true,
	bio: true,
	avatar: true,
	displayName: true,
});

export type GetProfileRequestType = z.infer<typeof getProfileRequestSchema>;
export type GetProfileResponseType = z.infer<typeof getProfileResponseSchema>;
