import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { messageController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	chatIdParamsSchema,
	markChatReadRequestSchema,
	sendMessageRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();

router.use(authMiddleware);

router.get(
	"/:chatId/messages/search",
	validate(chatIdParamsSchema, "params"),
	messageController.searchMessages,
);
router.get(
	"/:chatId/messages/unread",
	validate(chatIdParamsSchema, "params"),
	messageController.getUnreadCount,
);
router.post(
	"/:chatId/messages/read",
	validate(chatIdParamsSchema, "params"),
	validate(markChatReadRequestSchema),
	messageController.markChatRead,
);
router.get(
	"/:chatId/messages",
	validate(chatIdParamsSchema, "params"),
	messageController.listMessages,
);
router.post(
	"/:chatId/messages",
	validate(chatIdParamsSchema, "params"),
	validate(sendMessageRequestSchema),
	messageController.sendMessage,
);
router.post(
	"/:chatId/messages/pin",
	validate(chatIdParamsSchema, "params"),
	messageController.notImplemented,
);
router.post(
	"/:chatId/messages/reactions",
	validate(chatIdParamsSchema, "params"),
	messageController.notImplemented,
);

export default router;
