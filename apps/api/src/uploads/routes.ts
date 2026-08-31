import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { uploadController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	multerErrorHandler,
	uploadMiddleware,
} from "../middleware/upload.middleware";
import { attachmentIdParamsSchema } from "@bakbak/contracts";

const router = express.Router();

router.use(authMiddleware);

router.post("/", uploadMiddleware, multerErrorHandler, uploadController.upload);

router.get(
	"/:attachmentId",
	validate(attachmentIdParamsSchema, "params"),
	uploadController.getAttachment,
);

router.delete(
	"/:attachmentId",
	validate(attachmentIdParamsSchema, "params"),
	uploadController.deleteAttachment,
);

export default router;
