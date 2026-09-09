import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { userController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import { avatarUpload } from "@/middleware/file-upload";
import {
  checkUsernameRequestSchema,
  getProfileRequestSchema,
  searchUsersRequestSchema,
  updateAvatarRequestSchema,
  updateProfileRequestSchema,
} from "@bakbak/contracts";
import { rateLimitUsernameCheck } from "@/redis/rate-limit";

export const userRoutes = Router();

userRoutes.get(
  "/check-username",
  validate(checkUsernameRequestSchema, "query"),
  rateLimitUsernameCheck(),
  userController.checkUsername,
);

userRoutes.use(authMiddleware);
userRoutes.get("/me", userController.getMe);
userRoutes.patch(
  "/me",
  validate(updateProfileRequestSchema),
  userController.updateMe,
);

userRoutes.patch(
  "/me/avatar",
  validate(updateAvatarRequestSchema),
  userController.updateAvatar,
);

userRoutes.post(
  "/me/avatar",
  avatarUpload.middleware,
  avatarUpload.errorHandler,
  userController.uploadAvatar,
);

userRoutes.delete("/me", userController.deleteMe);

userRoutes.get(
  "/search",
  validate(searchUsersRequestSchema, "query"),
  userController.searchUsers,
);

userRoutes.get(
  "/:username",
  validate(getProfileRequestSchema, "params"),
  userController.getProfile,
);
