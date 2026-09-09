import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { uploadController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import { attachmentUpload } from "@/middleware/file-upload";
import { attachmentIdParamsSchema } from "@bakbak/contracts";
import { rateLimitAuthorized } from "@/redis/rate-limit";

export const uploadRoutes = Router();

uploadRoutes.use(authMiddleware);

// Rate-limited before multer, so a throttled client never gets its multipart
// buffered and rejected — the upload bucket gates the expensive path first.
uploadRoutes.post(
	"/",
	rateLimitAuthorized("uploads"),
	attachmentUpload.middleware,
	attachmentUpload.errorHandler,
	uploadController.upload,
);

uploadRoutes.get(
	"/:attachmentId",
	validate(attachmentIdParamsSchema, "params"),
	uploadController.getAttachment,
);

uploadRoutes.delete(
	"/:attachmentId",
	validate(attachmentIdParamsSchema, "params"),
	uploadController.deleteAttachment,
);
