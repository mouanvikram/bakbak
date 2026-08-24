import { z } from "zod";
import {
	chatParticipantSchema,
} from "./chat";

export enum MessageType {
	TEXT = "TEXT",
	IMAGE = "IMAGE",
	VIDEO = "VIDEO",
	AUDIO = "AUDIO",
	FILE = "FILE",
	STICKER = "STICKER",
	LOCATION = "LOCATION",
	CONTACT = "CONTACT",
	CALL = "CALL",
	SYSTEM = "SYSTEM",
}

export const messageSenderSchema = z.object({
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

export const messageResponseSchema = z.object({
	id: z.uuid(),
	chatId: z.uuid(),
	senderId: z.uuid(),
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
	deleted: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
	sender: messageSenderSchema,
});

export type MessageResponseType = z.infer<typeof messageResponseSchema>;
export type MessageSenderType = z.infer<typeof messageSenderSchema>;

export const sendMessageRequestSchema = z.object({
	// chatId comes from the route param; type falls back to TEXT and invalid
	// values are rejected by the controller so it can answer "Invalid request"
	type: z
		.enum([
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
		])
		.optional(),
	text: z.string().optional(),
});

export const sendMessageResponseSchema = messageResponseSchema;

export type SendMessageRequestType = z.infer<typeof sendMessageRequestSchema>;
export type SendMessageResponseType = z.infer<typeof sendMessageResponseSchema>;

export const listMessagesResponseSchema = z.object({
	messages: z.array(messageResponseSchema),
});

export type ListMessagesResponseType = z.infer<typeof listMessagesResponseSchema>;

export const getMessageRequestSchema = z.object({
	messageId: z.uuid(),
});

export const getMessageResponseSchema = z.object({
	message: messageResponseSchema,
});

export type GetMessageRequestType = z.infer<typeof getMessageRequestSchema>;
export type GetMessageResponseType = z.infer<typeof getMessageResponseSchema>;

// messageId comes from the route param
export const editMessageRequestSchema = z.object({
	text: z.string().min(1),
});

export const editMessageResponseSchema = messageResponseSchema;

export type EditMessageRequestType = z.infer<typeof editMessageRequestSchema>;
export type EditMessageResponseType = z.infer<typeof editMessageResponseSchema>;

export const deleteMessageResponseSchema = messageResponseSchema;

export type DeleteMessageResponseType = z.infer<typeof deleteMessageResponseSchema>;

// chatId comes from the route param; messageId is optional (defaults to
// the latest message in the chat)
export const markChatReadRequestSchema = z.object({
	messageId: z.uuid().optional(),
});

export type MarkChatReadRequestType = z.infer<typeof markChatReadRequestSchema>;

export const markChatReadResponseSchema = chatParticipantSchema;

export type MarkChatReadResponseType = z.infer<typeof markChatReadResponseSchema>;

export const searchMessagesResponseSchema = z.object({
	messages: z.array(messageResponseSchema),
});

export type SearchMessagesResponseType = z.infer<typeof searchMessagesResponseSchema>;

export const getUnreadCountResponseSchema = z.object({
	count: z.number(),
});

export type GetUnreadCountResponseType = z.infer<
	typeof getUnreadCountResponseSchema
>;

export interface ChatMessagesDto {
	currentUserId: string;
	chatId: string;
	limit?: number;
	cursor?: string;
}

export interface SendMessageDto extends ChatMessagesDto {
	text?: string;
	type: MessageType;
}

export interface MessageIdDto {
	currentUserId: string;
	messageId: string;
}

export interface EditMessageDto extends MessageIdDto {
	text: string;
}

export interface MarkChatReadDto extends ChatMessagesDto {
	messageId?: string;
}

export interface SearchMessagesDto extends ChatMessagesDto {
	query: string;
}
