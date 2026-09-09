import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { friendController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import {
	friendIdParamsSchema,
	friendRequestIdParamsSchema,
	sendFriendRequestRequestSchema,
} from "@bakbak/contracts";
import { rateLimitAuthorized } from "@/redis/rate-limit";

export const friendRoutes = Router();

friendRoutes.use(authMiddleware);
friendRoutes.post(
	"/requests/:receiverId",
	validate(sendFriendRequestRequestSchema, "params"),
	rateLimitAuthorized("friendRequest"),
	friendController.sendRequest,
);
friendRoutes.post(
	"/requests/:requestId/accept",
	validate(friendRequestIdParamsSchema, "params"),
	friendController.acceptRequest,
);

friendRoutes.post(
	"/requests/:requestId/reject",
	validate(friendRequestIdParamsSchema, "params"),
	friendController.rejectRequest,
);

friendRoutes.delete(
	"/requests/:requestId",
	validate(friendRequestIdParamsSchema, "params"),
	friendController.cancelRequest,
);

friendRoutes.get("/", friendController.getFriends);
friendRoutes.get("/requests", friendController.getPendingRequest);
friendRoutes.get("/suggestions", friendController.getSuggestions);

friendRoutes.delete(
	"/:friendId",
	validate(friendIdParamsSchema, "params"),
	friendController.removeFriend,
);
