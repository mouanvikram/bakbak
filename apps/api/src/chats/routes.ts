import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { chatController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import { chatMessageRoutes } from "@/messages/routes";
import {
  addParticipantRequestSchema,
  chatIdParamsSchema,
  chatMemberParamsSchema,
  createChatRequestSchema,
  listChatsQuerySchema,
  updateChatParticipantRequestSchema,
  updateChatRequestSchema,
} from "@bakbak/contracts";
import { rateLimitAuthorized } from "@/redis/rate-limit";

export const chatRoutes = Router();
chatRoutes.use(authMiddleware);

chatRoutes.post(
  "/",
  validate(createChatRequestSchema),
  rateLimitAuthorized("chat"),
  chatController.createChat,
);
chatRoutes.get(
  "/",
  validate(listChatsQuerySchema, "query"),
  chatController.listChats,
);
chatRoutes.get(
  "/:chatId",
  validate(chatIdParamsSchema, "params"),
  chatController.getChat,
);
chatRoutes.patch(
  "/:chatId",
  validate(chatIdParamsSchema, "params"),
  validate(updateChatRequestSchema),
  chatController.updateChat,
);
chatRoutes.delete(
  "/:chatId",
  validate(chatIdParamsSchema, "params"),
  chatController.deleteChat,
);

// "Delete for me" — leave the chat without destroying it for others.
chatRoutes.post(
  "/:chatId/leave",
  validate(chatIdParamsSchema, "params"),
  chatController.leaveChat,
);

chatRoutes.use("/:chatId/messages", chatMessageRoutes);

// Caller's own membership preferences (mute / pin / archive)
chatRoutes.patch(
  "/:chatId/participant",
  validate(chatIdParamsSchema, "params"),
  validate(updateChatParticipantRequestSchema),
  chatController.updateParticipantSettings,
);

chatRoutes.post(
  "/:chatId/members",
  validate(chatIdParamsSchema, "params"),
  validate(addParticipantRequestSchema),
  rateLimitAuthorized("chat"),
  chatController.addParticipant,
);
chatRoutes.delete(
  "/:chatId/members/:userId",
  validate(chatMemberParamsSchema, "params"),
  chatController.removeParticipant,
);
