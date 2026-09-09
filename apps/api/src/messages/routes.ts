import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { messageController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import {
	chatIdParamsSchema,
	editMessageRequestSchema,
	getMessageRequestSchema,
	listMessagesQuerySchema,
	markChatReadRequestSchema,
	searchMessagesQuerySchema,
	sendMessageRequestSchema,
} from "@bakbak/contracts";
import { rateLimitAuthorized } from "@/redis/rate-limit";

/**
 * Message routes nested under a chat: `/api/v1/chats/:chatId/messages/*`.
 * Mounted by `chatRoutes`, which already applies `authMiddleware`.
 */
export const chatMessageRoutes = Router({ mergeParams: true });

chatMessageRoutes.use(validate(chatIdParamsSchema, "params"));

chatMessageRoutes.get(
	"/search",
	validate(searchMessagesQuerySchema, "query"),
	messageController.searchMessages,
);
chatMessageRoutes.get("/unread", messageController.getUnreadCount);
chatMessageRoutes.post(
	"/read",
	validate(markChatReadRequestSchema),
	messageController.markChatRead,
);
chatMessageRoutes.get(
	"/",
	validate(listMessagesQuerySchema, "query"),
	messageController.listMessages,
);
chatMessageRoutes.post(
	"/",
	validate(sendMessageRequestSchema),
	rateLimitAuthorized("messageSend"),
	messageController.sendMessage,
);

/**
 * Top-level, chat-agnostic message item routes: `/api/v1/messages/:messageId`.
 */
export const messageRoutes = Router();

messageRoutes.use(authMiddleware);

messageRoutes.get(
	"/:messageId",
	validate(getMessageRequestSchema, "params"),
	messageController.getMessage,
);
messageRoutes.patch(
	"/:messageId",
	validate(getMessageRequestSchema, "params"),
	validate(editMessageRequestSchema),
	messageController.editMessage,
);
messageRoutes.delete(
	"/:messageId",
	validate(getMessageRequestSchema, "params"),
	messageController.deleteMessage,
);
