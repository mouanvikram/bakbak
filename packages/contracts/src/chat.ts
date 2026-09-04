import { z } from "zod";
import {
	messageTypeSchema,
	okResponseSchema,
	profileCoreSchema,
	safeString,
} from "./shared";

export const chatUserSchema = z.object({
	id: z.uuid(),
	username: safeString(100),
	profile: profileCoreSchema.nullish(),
});

export type ChatUserType = z.infer<typeof chatUserSchema>;

export const chatMessageSchema = z.object({
	id: z.uuid(),
	type: messageTypeSchema,
	text: safeString(5000).nullish(),
	senderId: z.uuid(),
	chatId: z.uuid(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type ChatMessageType = z.infer<typeof chatMessageSchema>;

export const chatParticipantSchema = z.object({
	id: z.uuid(),
	chatId: z.uuid(),
	userId: z.uuid(),
	role: z.enum(["MEMBER", "ADMIN"]),
	joinedAt: z.string(),
	lastReadMessageId: z.string().nullish(),
	mutedUntil: z.string().nullish(),
	isPinned: z.boolean(),
	isArchived: z.boolean(),
	leftAt: z.string().nullish(),
	user: chatUserSchema,
});

export type ChatParticipantType = z.infer<typeof chatParticipantSchema>;

const chatBaseSchema = z.object({
	id: z.uuid(),
	type: z.enum(["DIRECT", "GROUP"]),
	directKey: safeString(100).nullish(),
	name: safeString(100).nullish(),
	description: safeString(500).nullish(),
	avatar: safeString(1024).nullish(),
	createdById: z.string().nullish(),
	lastMessageAt: z.string().nullish(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const chatResponseSchema = chatBaseSchema.extend({
	createdBy: chatUserSchema.nullish(),
	participants: z.array(chatParticipantSchema),
	messages: z.array(chatMessageSchema),
});

export type ChatResponseType = z.infer<typeof chatResponseSchema>;

export const chatIdParamsSchema = z.object({
	chatId: z.uuid(),
});

export type ChatIdParamsType = z.infer<typeof chatIdParamsSchema>;

/**
 * Single request schema for `POST /chats`, discriminated on `type`.
 * Replaces the old per-branch schemas + hand-rolled controller parsing.
 */
export const createChatRequestSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("DIRECT"),
		participantId: z.uuid(),
	}),
	z.object({
		type: z.literal("GROUP"),
		name: safeString(100, 1),
		// A group is at least 3 people: the creator plus two others.
		participantIds: z.array(z.uuid()).min(2),
		avatar: safeString(1024).optional(),
		description: safeString(500).optional(),
	}),
]);

export type CreateChatRequestType = z.infer<typeof createChatRequestSchema>;

export const listChatsQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(30),
	cursor: z.uuid().optional(),
});

export type ListChatsQueryType = z.infer<typeof listChatsQuerySchema>;

export const chatMemberParamsSchema = z.object({
	chatId: z.uuid(),
	userId: z.uuid(),
});

export type ChatMemberParamsType = z.infer<typeof chatMemberParamsSchema>;

export const createChatResponseSchema = chatResponseSchema;

export type CreateChatResponseType = z.infer<typeof createChatResponseSchema>;

export const listChatsResponseSchema = z.object({
	chats: z.array(chatResponseSchema),
});

export type ListChatsResponseType = z.infer<typeof listChatsResponseSchema>;

export const getChatResponseSchema = chatResponseSchema;

export type GetChatResponseType = z.infer<typeof getChatResponseSchema>;

export const updateChatRequestSchema = z.object({
	name: safeString(100).optional(),
	avatar: safeString(1024).nullish(),
	description: safeString(500).nullish(),
});

export const updateChatResponseSchema = chatResponseSchema;

export type UpdateChatRequestType = z.infer<typeof updateChatRequestSchema>;
export type UpdateChatResponseType = z.infer<typeof updateChatResponseSchema>;

export const deleteChatResponseSchema = chatBaseSchema;

export type DeleteChatResponseType = z.infer<typeof deleteChatResponseSchema>;

/** `POST /chats/:chatId/leave` — removes the caller from the chat (hide for me). */
export const leaveChatResponseSchema = okResponseSchema;

export type LeaveChatResponseType = z.infer<typeof leaveChatResponseSchema>;

export const addParticipantRequestSchema = z.object({
	participantId: z.uuid(),
});

// Per-user, per-chat preferences on the caller's own membership row.
export const updateChatParticipantRequestSchema = z
	.object({
		mutedUntil: z.iso.datetime().nullish(),
		isPinned: z.boolean().optional(),
		isArchived: z.boolean().optional(),
	})
	.refine(
		(v) =>
			v.mutedUntil !== undefined ||
			v.isPinned !== undefined ||
			v.isArchived !== undefined,
		{ message: "Nothing to update" },
	);

export type UpdateChatParticipantRequestType = z.infer<
	typeof updateChatParticipantRequestSchema
>;

export const updateChatParticipantResponseSchema = chatParticipantSchema;

export type UpdateChatParticipantResponseType = z.infer<
	typeof updateChatParticipantResponseSchema
>;

export interface UpdateChatParticipantDto {
	currentUserId: string;
	chatId: string;
	mutedUntil?: string | null;
	isPinned?: boolean;
	isArchived?: boolean;
}

export const addParticipantResponseSchema = chatParticipantSchema;

export type AddParticipantRequestType = z.infer<typeof addParticipantRequestSchema>;
export type AddParticipantResponseType = z.infer<typeof addParticipantResponseSchema>;

export const removeParticipantResponseSchema = chatParticipantSchema;

export type RemoveParticipantResponseType = z.infer<
	typeof removeParticipantResponseSchema
>;

export interface ChatIdDto {
	currentUserId: string;
	chatId: string;
}

export interface CreateDirectChatDto {
	currentUserId: string;
	participantId: string;
}

export interface CreateGroupChatDto {
	currentUserId: string;
	name: string;
	participantIds: string[];
	avatar?: string | null;
	description?: string | null;
}

export interface ListChatsDto {
	currentUserId: string;
	limit?: number;
	cursor?: string;
}

export interface ParticipantDto {
	currentUserId: string;
	chatId: string;
	participantId: string;
}

export interface UpdateChatDto {
	currentUserId: string;
	chatId: string;
	name?: string;
	avatar?: string | null;
	description?: string | null;
}
