import { z } from "zod";
import {
	MessageType,
	messageTypeSchema,
	profileCoreSchema,
	safeString,
	singleItemResponseSchema,
	userSummarySchema,
	arrayResponseSchema,
} from "./shared";
import { chatParticipantSchema } from "./chat";
import { attachmentResponseSchema } from "./upload";

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
	attachments: z.array(attachmentResponseSchema).default([]),
});

export type MessageResponseType = z.infer<typeof messageResponseSchema>;

/** Max attachments carried by a single message. */
export const MAX_MESSAGE_ATTACHMENTS = 10;

export const sendMessageRequestSchema = z.object({
	type: messageTypeSchema.optional(),
	text: safeString(5000).optional(),
	attachmentIds: z
		.array(z.uuid())
		.min(1)
		.max(MAX_MESSAGE_ATTACHMENTS)
		.optional(),
	// Idempotency key: a retry with the same clientId returns the original message.
	// Required — the column is NOT NULL, so a missing one has to fail validation
	// with a 400 rather than blowing up on insert.
	clientId: z.uuid(),
});

export const sendMessageResponseSchema = messageResponseSchema;

export type SendMessageRequestType = z.infer<typeof sendMessageRequestSchema>;
export type SendMessageResponseType = z.infer<typeof sendMessageResponseSchema>;

export const listMessagesResponseSchema = arrayResponseSchema(
	"messages",
	messageResponseSchema,
);

export type ListMessagesResponseType = z.infer<typeof listMessagesResponseSchema>;

export const listMessagesQuerySchema = z.object({
	limit: z.coerce
		.number()
		.int()
		.positive()
		.catch(50)
		.transform((n) => Math.min(n, 100))
		.default(50),
	cursor: z.uuid().optional(),
});

export type ListMessagesQueryType = z.infer<typeof listMessagesQuerySchema>;

export const searchMessagesQuerySchema = listMessagesQuerySchema.extend({
	q: safeString(200),
});

export type SearchMessagesQueryType = z.infer<typeof searchMessagesQuerySchema>;

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
	attachmentIds?: string[];
	clientId: string;
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
