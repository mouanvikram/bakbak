import { z } from "zod";

export const friendUserSchema = z.object({
	id: z.uuid(),
	username: z.string(),
	profile: z
		.object({
			displayName: z.string().nullish(),
			firstName: z.string().nullish(),
			lastName: z.string().nullish(),
			avatar: z.string().nullish(),
			bio: z.string().nullish(),
		})
		.nullish(),
});

export type FriendUserType = z.infer<typeof friendUserSchema>;

export const friendRequestResponseSchema = z.object({
	id: z.uuid(),
	status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]),
	createdAt: z.string(),
	updatedAt: z.string(),
	sender: friendUserSchema,
	receiver: friendUserSchema,
});

export type FriendRequestResponseType = z.infer<
	typeof friendRequestResponseSchema
>;

export const friendshipResponseSchema = z.object({
	friendshipId: z.uuid(),
	createdAt: z.string(),
	friend: friendUserSchema,
});

export type FriendshipResponseType = z.infer<typeof friendshipResponseSchema>;

export const sendFriendRequestRequestSchema = z.object({
	receiverId: z.uuid(),
});

export const sendFriendRequestResponseSchema = friendRequestResponseSchema;

export type SendFriendRequestRequestType = z.infer<
	typeof sendFriendRequestRequestSchema
>;
export type SendFriendRequestResponseType = z.infer<
	typeof sendFriendRequestResponseSchema
>;

export const cancelFriendRequestResponseSchema = friendRequestResponseSchema;

export type CancelFriendRequestResponseType = z.infer<
	typeof cancelFriendRequestResponseSchema
>;

export const acceptFriendRequestResponseSchema = friendRequestResponseSchema;

export type AcceptFriendRequestResponseType = z.infer<
	typeof acceptFriendRequestResponseSchema
>;

export const rejectFriendRequestResponseSchema = friendRequestResponseSchema;

export type RejectFriendRequestResponseType = z.infer<
	typeof rejectFriendRequestResponseSchema
>;

export const getFriendsResponseSchema = z.object({
	friendships: z.array(friendshipResponseSchema),
});

export type GetFriendsResponseType = z.infer<typeof getFriendsResponseSchema>;

export const getPendingRequestsResponseSchema = z.object({
	sent: z.array(friendRequestResponseSchema),
	received: z.array(friendRequestResponseSchema),
});

export type GetPendingRequestsResponseType = z.infer<
	typeof getPendingRequestsResponseSchema
>;

export interface FriendRequestType {
	senderId: string;
	receiverId: string;
}

export interface FriendRequestIdType {
	id: string;
}
