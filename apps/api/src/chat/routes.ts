import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { chatController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	addParticipantRequestSchema,
	createGroupChatRequestSchema,
	updateChatRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();
router.use(authMiddleware);

// Chats
router.post("/", chatController.createChat);
router.get("/", chatController.listChats);
router.get("/:chatId", chatController.getChat);
router.patch(
	"/:chatId",
	validate(updateChatRequestSchema),
	chatController.updateChat,
);
router.delete("/:chatId", chatController.deleteChat);

// Participants
router.post(
	"/:chatId/members",
	validate(addParticipantRequestSchema),
	chatController.addParticipant,
);
router.delete("/:chatId/members/:userId", chatController.removeParticipant);

export default router;
