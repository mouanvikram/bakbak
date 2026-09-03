import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { chatController } from "../services/service.container";
import { validate } from "../middleware/validate";
import { chatMessageRoutes } from "../messages/routes";
import {
	addParticipantRequestSchema,
	chatIdParamsSchema,
	chatMemberParamsSchema,
	createChatRequestSchema,
	listChatsQuerySchema,
	updateChatRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();
router.use(authMiddleware);
// Chats
router.post("/", validate(createChatRequestSchema), chatController.createChat);
router.get(
	"/",
	validate(listChatsQuerySchema, "query"),
	chatController.listChats,
);
router.get(
	"/:chatId",
	validate(chatIdParamsSchema, "params"),
	chatController.getChat,
);
router.patch(
	"/:chatId",
	validate(chatIdParamsSchema, "params"),
	validate(updateChatRequestSchema),
	chatController.updateChat,
);
router.delete(
	"/:chatId",
	validate(chatIdParamsSchema, "params"),
	chatController.deleteChat,
);

// Messages nested under a chat: /:chatId/messages/*
router.use("/:chatId/messages", chatMessageRoutes);

// Participants
router.post(
	"/:chatId/members",
	validate(chatIdParamsSchema, "params"),
	validate(addParticipantRequestSchema),
	chatController.addParticipant,
);
router.delete(
	"/:chatId/members/:userId",
	validate(chatMemberParamsSchema, "params"),
	chatController.removeParticipant,
);

export default router;
