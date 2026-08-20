import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { messageController } from "../services/service.container";
import { validate } from "../middleware/validate";
import { editMessageRequestSchema, getMessageRequestSchema } from "@bakbak/contracts";

const router = express.Router();

router.use(authMiddleware);

router.get(
	"/:messageId",
	validate(getMessageRequestSchema, "params"),
	messageController.getMessage,
);
router.patch(
	"/:messageId",
	validate(getMessageRequestSchema, "params"),
	validate(editMessageRequestSchema),
	messageController.editMessage,
);
router.delete(
	"/:messageId",
	validate(getMessageRequestSchema, "params"),
	messageController.deleteMessage,
);

router.post("/:messageId/reactions", messageController.notImplemented);
router.delete("/:messageId/reactions", messageController.notImplemented);
router.post("/:messageId/reply", messageController.notImplemented);
router.patch("/:messageId/pin", messageController.notImplemented);

export default router;
