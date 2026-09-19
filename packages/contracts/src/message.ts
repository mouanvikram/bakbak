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
import { callStatusSchema, callTypeSchema } from "./calls";

/**
 * The call a `type: "CALL"` message describes.
 *
 * Deliberately not a full CallRecord: direction is per-viewer ("incoming" for
 * one participant is "outgoing" for the other), and a message is the same for
 * everyone who reads it. The client derives direction by comparing `callerId`
 * against the current user.
 */
export const messageCallSchema = z.object({
  id: z.uuid(),
  type: callTypeSchema,
  status: callStatusSchema,
  callerId: z.uuid(),
  startedAt: z.string(),
  answeredAt: z.string().nullish(),
  endedAt: z.string().nullish(),
  durationSeconds: z.number().int().nonnegative().nullish(),
});

export type MessageCallType = z.infer<typeof messageCallSchema>;

export const messageSenderSchema = userSummarySchema.extend({
  profile: profileCoreSchema.nullish(),
});

export type MessageSenderType = z.infer<typeof messageSenderSchema>;

export const reactionResponseSchema = z.object({
  id: z.uuid(),
  emoji: z.string().trim().min(1).max(8),
  userId: z.uuid(),
  messageId: z.uuid(),
  createdAt: z.string(),
});

export type ReactionResponseType = z.infer<typeof reactionResponseSchema>;

export const toggleReactionRequestSchema = z.object({
  emoji: z.string().trim().min(1).max(8),
});

export type ToggleReactionRequestType = z.infer<
  typeof toggleReactionRequestSchema
>;

// The message a reply answers: the same shape as a full message but without a
// nested `replyTo` of its own. Replies resolve one hop deep, so both the wire
// format and the serialiser stay non-recursive.
export const repliedMessageSchema = z.object({
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
  replyToId: z.uuid().nullish(),
  reactions: z.array(reactionResponseSchema).default([]),
});

export type RepliedMessageType = z.infer<typeof repliedMessageSchema>;

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
  // Reply chain: the id of the message this one answers, and its payload.
  replyToId: z.uuid().nullish(),
  replyTo: repliedMessageSchema.nullish(),
  reactions: z.array(reactionResponseSchema).default([]),
  // Present only on `type: "CALL"`. The outcome lives on the call row, not
  // copied onto the message, so the timeline entry and the Calls tab can never
  // disagree about what happened.
  call: messageCallSchema.nullish(),
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
  // The message this one is answering, if any.
  replyToId: z.uuid().optional(),
});

export const sendMessageResponseSchema = messageResponseSchema;

export type SendMessageRequestType = z.infer<typeof sendMessageRequestSchema>;
export type SendMessageResponseType = z.infer<typeof sendMessageResponseSchema>;

export const listMessagesResponseSchema = arrayResponseSchema(
  "messages",
  messageResponseSchema,
);

export type ListMessagesResponseType = z.infer<
  typeof listMessagesResponseSchema
>;

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

export type DeleteMessageResponseType = z.infer<
  typeof deleteMessageResponseSchema
>;

export const toggleReactionResponseSchema = messageResponseSchema;

export type ToggleReactionResponseType = z.infer<
  typeof toggleReactionResponseSchema
>;

// Params for the nested reaction route: /chats/:chatId/messages/:messageId/reactions.
export const chatMessageIdParamsSchema = z.object({
  chatId: z.uuid(),
  messageId: z.uuid(),
});

export type ChatMessageIdParamsType = z.infer<typeof chatMessageIdParamsSchema>;

export const markChatReadRequestSchema = z.object({
  messageId: z.uuid().optional(),
});

export type MarkChatReadRequestType = z.infer<typeof markChatReadRequestSchema>;

export const markChatReadResponseSchema = chatParticipantSchema;

export type MarkChatReadResponseType = z.infer<
  typeof markChatReadResponseSchema
>;

export const searchMessagesResponseSchema = arrayResponseSchema(
  "messages",
  messageResponseSchema,
);

export type SearchMessagesResponseType = z.infer<
  typeof searchMessagesResponseSchema
>;

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
  replyToId?: string;
}

export interface MessageIdDto {
  currentUserId: string;
  messageId: string;
}

export interface ToggleReactionDto extends MessageIdDto {
  chatId: string;
  emoji: string;
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
