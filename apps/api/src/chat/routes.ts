import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { chatController } from "../services/service.container";

const router = express.Router();
router.use(authMiddleware);

// Chats
router.post("/", chatController.createChat);      // Direct or Group
router.get("/", chatController.listChats);
router.get("/:chatId", chatController.getChat);
router.patch("/:chatId",chatController.updateChat);
router.delete("/:chatId", chatController.deleteChat);

// Participants
router.post("/:chatId/members", chatController.addParticipant);
router.delete("/:chatId/members/:userId", chatController.removeParticipant);

export default router;
