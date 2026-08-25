import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { chatController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	addParticipantRequestSchema,
	chatIdParamsSchema,
	updateChatRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();
router.use(authMiddleware);
// Chats
router.post("/", chatController.createChat);
router.get("/", chatController.listChats);
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

// Participants
router.post(
	"/:chatId/members",
	validate(chatIdParamsSchema, "params"),
	validate(addParticipantRequestSchema),
	chatController.addParticipant,
);
router.delete(
	"/:chatId/members/:userId",
	validate(chatIdParamsSchema, "params"),
	chatController.removeParticipant,
);

export default router;
