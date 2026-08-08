import express from "express";
import { authMiddleware } from "../middleware/auth.middleware"; //modified
import { messageController } from "../services/service.container"; //modified

const router = express.Router();

router.use(authMiddleware); //modified

router.get("/:messageId", messageController.getMessage); //modified
router.patch("/:messageId", messageController.editMessage); //modified
router.delete("/:messageId", messageController.deleteMessage); //modified

router.post("/:messageId/reactions", messageController.notImplemented); //modified
router.delete("/:messageId/reactions", messageController.notImplemented); //modified
router.post("/:messageId/reply", messageController.notImplemented); //modified
router.patch("/:messageId/pin", messageController.notImplemented); //modified

export default router;
