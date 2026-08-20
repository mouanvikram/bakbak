import { z } from "zod";

export const userProfileSchema = z.object({
	id: z.uuid(),
	email: z.email(),
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

// get me

export const getMeResponseSchema = z.object({
	profile: userProfileSchema,
});

export type GetMeResponseType = z.infer<typeof getMeResponseSchema>;

// update profile

export const updateProfileRequestSchema = z.object({
	bio: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	displayName: z.string().optional(),
});

export const updateProfileResponseSchema = z.object({
	username: z.string(),
	verified: z.boolean(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	bio: z.string().nullish(),
	avatar: z.string().nullish(),
	displayName: z.string().nullish(),
});

export type UpdateProfileRequestType = z.infer<typeof updateProfileRequestSchema>;
export type UpdateProfileResponseType = z.infer<typeof updateProfileResponseSchema>;

// update avatar

export const updateAvatarRequestSchema = z.object({
	avatar: z.string(),
});

export const updateAvatarResponseSchema = z.object({
	avatar: z.string().nullish(),
});

export type UpdateAvatarRequestType = z.infer<typeof updateAvatarRequestSchema>;
export type UpdateAvatarResponseType = z.infer<typeof updateAvatarResponseSchema>;

// delete me

export const deleteMeResponseSchema = z.object({
	message: z.string(),
});

export type DeleteMeResponseType = z.infer<typeof deleteMeResponseSchema>;

// check username

export const checkUsernameRequestSchema = z.object({
	username: z.string().min(1),
});

export const checkUsernameResponseSchema = z.object({
	available: z.boolean(),
});

export type CheckUsernameRequestType = z.infer<typeof checkUsernameRequestSchema>;
export type CheckUsernameResponseType = z.infer<
	typeof checkUsernameResponseSchema
>;

// search users

export const searchUsersRequestSchema = z.object({
	query: z.string(),
});

export const searchUserSchema = z.object({
	id: z.uuid(),
	username: z.string(),
	profile: z
		.object({
			firstName: z.string().nullish(),
			lastName: z.string().nullish(),
			bio: z.string().nullish(),
			displayName: z.string().nullish(),
			avatar: z.string().nullish(),
		})
		.nullish(),
});

export const searchUsersResponseSchema = z.object({
	users: z.array(searchUserSchema),
});

export type SearchUsersRequestType = z.infer<typeof searchUsersRequestSchema>;
export type SearchUserType = z.infer<typeof searchUserSchema>;
export type SearchUsersResponseType = z.infer<typeof searchUsersResponseSchema>;

// get profile (other user)

export const getProfileRequestSchema = z.object({
	username: z.string().min(1),
});

export const getProfileResponseSchema = z.object({
	username: z.string(),
	verified: z.boolean(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	bio: z.string().nullish(),
	avatar: z.string().nullish(),
	displayName: z.string().nullish(),
});

export type GetProfileRequestType = z.infer<typeof getProfileRequestSchema>;
export type GetProfileResponseType = z.infer<typeof getProfileResponseSchema>;
