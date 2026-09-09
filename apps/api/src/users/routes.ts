import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { userController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import { avatarUpload } from "@/middleware/file-upload";
import {
  checkUsernameRequestSchema,
  deleteMeChallengeRequestSchema,
  deleteMeRequestSchema,
  getProfileRequestSchema,
  searchUsersRequestSchema,
  updateAvatarRequestSchema,
  updateProfileRequestSchema,
} from "@bakbak/contracts";
import { rateLimitEmails, rateLimitUsernameCheck } from "@/redis/rate-limit";

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

userRoutes.post(
  "/me/delete-challenge",
  validate(deleteMeChallengeRequestSchema),
  rateLimitEmails(),
  userController.requestDeletionChallenge,
);

userRoutes.delete("/me", validate(deleteMeRequestSchema), userController.deleteMe);

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
