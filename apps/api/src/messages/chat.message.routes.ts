import express from "express";
import { authMiddleware } from "../middleware/auth.middleware"; //modified
import { messageController } from "../services/service.container"; //modified
const router = express.Router();

router.use(authMiddleware); //modified

router.get("/:chatId/messages/search", messageController.searchMessages); //modified
router.get("/:chatId/messages/unread", messageController.getUnreadCount); //modified
router.post("/:chatId/messages/read", messageController.markChatRead); //modified
router.get("/:chatId/messages", messageController.listMessages); //modified
router.post("/:chatId/messages", messageController.sendMessage); //modified

router.post("/:chatId/messages/pin", messageController.notImplemented); //modified
router.post("/:chatId/messages/reactions", messageController.notImplemented); //modified

export default router;
