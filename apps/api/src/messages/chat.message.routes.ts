import express from "express";
import { authMiddleware } from "../middleware/auth.middleware"; 
import { messageController } from "../services/service.container"; 
const router = express.Router();

router.use(authMiddleware); 

router.get("/:chatId/messages/search", messageController.searchMessages); 
router.get("/:chatId/messages/unread", messageController.getUnreadCount);
router.post("/:chatId/messages/read", messageController.markChatRead); 
router.get("/:chatId/messages", messageController.listMessages); 
router.post("/:chatId/messages", messageController.sendMessage);
router.post("/:chatId/messages/pin", messageController.notImplemented); 
router.post("/:chatId/messages/reactions", messageController.notImplemented); 

export default router;
