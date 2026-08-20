import { z } from "zod";

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
	chatId: z.uuid(),
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

export const editMessageRequestSchema = z.object({
	messageId: z.uuid(),
	text: z.string().min(1),
});

export const editMessageResponseSchema = messageResponseSchema;

export type EditMessageRequestType = z.infer<typeof editMessageRequestSchema>;
export type EditMessageResponseType = z.infer<typeof editMessageResponseSchema>;

export const deleteMessageResponseSchema = messageResponseSchema;

export type DeleteMessageResponseType = z.infer<typeof deleteMessageResponseSchema>;

export const markChatReadRequestSchema = z.object({
	chatId: z.uuid(),
	messageId: z.uuid().optional(),
});

export type MarkChatReadRequestType = z.infer<typeof markChatReadRequestSchema>;

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
