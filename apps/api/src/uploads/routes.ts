import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { uploadController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	multerErrorHandler,
	uploadMiddleware,
} from "../middleware/upload.middleware";
import { attachmentIdParamsSchema } from "@bakbak/contracts";
import { rateLimitAuthorized } from "../redis/rate-limit";

const router = express.Router();

router.use(authMiddleware);

// Rate-limited before multer, so a throttled client never gets its multipart
// buffered and rejected — the upload bucket gates the expensive path first.
router.post(
	"/",
	rateLimitAuthorized("uploads"),
	uploadMiddleware,
	multerErrorHandler,
	uploadController.upload,
);

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
