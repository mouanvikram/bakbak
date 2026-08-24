import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { uploadController } from "../services/service.container";

const router = express.Router();

router.use(authMiddleware);

router.post("/", uploadController.upload);
router.get("/:attachmentId", uploadController.getAttachment);
router.delete("/:attachmentId", uploadController.deleteAttachment);

export default router;
