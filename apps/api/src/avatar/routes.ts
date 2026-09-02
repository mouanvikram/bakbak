import { Router } from "express";
import { avatarController } from "../services/service.container";
import {
	avatarMulterErrorHandler,
	avatarUploadMiddleware,
} from "./avatar.middleware";

const router = Router();

router.post(
	"/avatar",
	avatarUploadMiddleware,
	avatarMulterErrorHandler,
	avatarController.upload,
);

export default router;
