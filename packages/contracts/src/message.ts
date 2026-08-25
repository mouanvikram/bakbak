import { z } from "zod";
import {
	MessageType,
	messageTypeSchema,
	profileCoreSchema,
	safeString,
	singleItemResponseSchema,
	userSummarySchema,
	uuidParam,
	arrayResponseSchema,
} from "./shared";
import { chatParticipantSchema } from "./chat";

export const messageSenderSchema = userSummarySchema.extend({
	profile: profileCoreSchema.nullish(),
});

export type MessageSenderType = z.infer<typeof messageSenderSchema>;

export const messageResponseSchema = z.object({
	id: z.uuid(),
	chatId: z.uuid(),
	senderId: z.uuid(),
	type: messageTypeSchema,
	text: safeString(5000).nullish(),
	deleted: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
	sender: messageSenderSchema,
});

export type MessageResponseType = z.infer<typeof messageResponseSchema>;

export const sendMessageRequestSchema = z.object({
	type: messageTypeSchema.optional(),
	text: safeString(5000).optional(),
});

export const sendMessageResponseSchema = messageResponseSchema;

export type SendMessageRequestType = z.infer<typeof sendMessageRequestSchema>;
export type SendMessageResponseType = z.infer<typeof sendMessageResponseSchema>;

export const listMessagesResponseSchema = arrayResponseSchema(
	"messages",
	messageResponseSchema,
);

export type ListMessagesResponseType = z.infer<typeof listMessagesResponseSchema>;

export const getMessageRequestSchema = z.object({
	messageId: z.uuid(),
});

export const getMessageResponseSchema = singleItemResponseSchema(
	"message",
	messageResponseSchema,
);

export type GetMessageRequestType = z.infer<typeof getMessageRequestSchema>;
export type GetMessageResponseType = z.infer<typeof getMessageResponseSchema>;

export const editMessageRequestSchema = z.object({
	text: safeString(5000, 1),
});

export const editMessageResponseSchema = messageResponseSchema;

export type EditMessageRequestType = z.infer<typeof editMessageRequestSchema>;
export type EditMessageResponseType = z.infer<typeof editMessageResponseSchema>;

export const deleteMessageResponseSchema = messageResponseSchema;

export type DeleteMessageResponseType = z.infer<typeof deleteMessageResponseSchema>;

export const markChatReadRequestSchema = z.object({
	messageId: z.uuid().optional(),
});

export type MarkChatReadRequestType = z.infer<typeof markChatReadRequestSchema>;

export const markChatReadResponseSchema = chatParticipantSchema;

export type MarkChatReadResponseType = z.infer<typeof markChatReadResponseSchema>;

export const searchMessagesResponseSchema = arrayResponseSchema(
	"messages",
	messageResponseSchema,
);

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
