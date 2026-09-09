import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { userController } from "../services/service.container";
import { validate } from "../middleware/validate";
import { avatarUpload } from "../middleware/file-upload";
import {
	checkUsernameRequestSchema,
	getProfileRequestSchema,
	searchUsersRequestSchema,
	updateAvatarRequestSchema,
	updateProfileRequestSchema,
} from "@bakbak/contracts";
import { rateLimitUsernameCheck } from "../redis/rate-limit";

const router = express.Router();

router.get(
	"/check-username",
	validate(checkUsernameRequestSchema, "query"),
	rateLimitUsernameCheck(),
	userController.checkUsername,
);

router.use(authMiddleware);
router.get("/me", userController.getMe);
router.patch(
	"/me",
	validate(updateProfileRequestSchema),
	userController.updateMe,
);

router.patch(
	"/me/avatar",
	validate(updateAvatarRequestSchema),
	userController.updateAvatar,
);

router.post(
	"/me/avatar",
	avatarUpload.middleware,
	avatarUpload.errorHandler,
	userController.uploadAvatar,
);

router.delete("/me", userController.deleteMe);

router.get(
	"/search",
	validate(searchUsersRequestSchema, "query"),
	userController.searchUsers,
);

router.get(
	"/:username",
	validate(getProfileRequestSchema, "params"),
	userController.getProfile,
);

export default router;
