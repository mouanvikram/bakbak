import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { userController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	checkUsernameRequestSchema,
	getProfileRequestSchema,
	searchUsersRequestSchema,
	updateAvatarRequestSchema,
	updateProfileRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();

//check user-name is available on login page as well
router.get(
	"/check-username",
	validate(checkUsernameRequestSchema, "query"),
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

// router.get("/:userId/presence")
// router.get("/:userId/block");
// router.get("/:userId/block");

export default router;
