import { Router } from "express";
import { avatarController } from "../services/service.container";
import {
	avatarMulterErrorHandler,
	avatarUploadMiddleware,
} from "./middleware";

const router = Router();

router.post(
	"/avatar",
	avatarUploadMiddleware,
	avatarMulterErrorHandler,
	avatarController.upload,
);

export default router;
