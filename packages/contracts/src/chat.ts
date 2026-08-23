import { z } from "zod";

export const chatUserSchema = z.object({
	id: z.uuid(),
	username: z.string(),
	profile: z
		.object({
			displayName: z.string().nullish(),
			firstName: z.string().nullish(),
			lastName: z.string().nullish(),
			avatar: z.string().nullish(),
		})
		.nullish(),
});

export type ChatUserType = z.infer<typeof chatUserSchema>;

export const chatMessageSchema = z.object({
	id: z.uuid(),
	type: z.enum([
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
	]),
	text: z.string().nullish(),
	senderId: z.uuid(),
	chatId: z.uuid(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type ChatMessageType = z.infer<typeof chatMessageSchema>;

export const chatParticipantSchema = z.object({
	id: z.uuid(),
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

export const chatResponseSchema = z.object({
	id: z.uuid(),
	type: z.enum(["DIRECT", "GROUP"]),
	directKey: z.string().nullish(),
	name: z.string().nullish(),
	description: z.string().nullish(),
	avatar: z.string().nullish(),
	createdById: z.string().nullish(),
	lastMessageAt: z.string().nullish(),
	createdAt: z.string(),
	updatedAt: z.string(),
	createdBy: chatUserSchema.nullish(),
	participants: z.array(chatParticipantSchema),
	messages: z.array(chatMessageSchema),
});

export type ChatResponseType = z.infer<typeof chatResponseSchema>;

export const createDirectChatRequestSchema = z.object({
	participantId: z.uuid(),
});

export const chatIdParamsSchema = z.object({
	chatId: z.uuid(),
});

export type ChatIdParamsType = z.infer<typeof chatIdParamsSchema>;

export type CreateDirectChatRequestType = z.infer<
	typeof createDirectChatRequestSchema
>;

export const createGroupChatRequestSchema = z.object({
	name: z.string().min(1),
	participantIds: z.array(z.uuid()).min(1),
	avatar: z.string().optional(),
});

export type CreateGroupChatRequestType = z.infer<
	typeof createGroupChatRequestSchema
>;

export const createChatResponseSchema = chatResponseSchema;

export type CreateChatResponseType = z.infer<typeof createChatResponseSchema>;

export const listChatsResponseSchema = z.object({
	chats: z.array(chatResponseSchema),
});

export type ListChatsResponseType = z.infer<typeof listChatsResponseSchema>;

export const getChatResponseSchema = chatResponseSchema;

export type GetChatResponseType = z.infer<typeof getChatResponseSchema>;

export const updateChatRequestSchema = z.object({
	name: z.string().optional(),
	avatar: z.string().nullish(),
});

export const updateChatResponseSchema = chatResponseSchema;

export type UpdateChatRequestType = z.infer<typeof updateChatRequestSchema>;
export type UpdateChatResponseType = z.infer<typeof updateChatResponseSchema>;

export const deleteChatResponseSchema = z.object({
	id: z.uuid(),
	type: z.enum(["DIRECT", "GROUP"]),
	directKey: z.string().nullish(),
	name: z.string().nullish(),
	description: z.string().nullish(),
	avatar: z.string().nullish(),
	createdById: z.string().nullish(),
	lastMessageAt: z.string().nullish(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type DeleteChatResponseType = z.infer<typeof deleteChatResponseSchema>;

export const addParticipantRequestSchema = z.object({
	participantId: z.uuid(),
});

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
}
