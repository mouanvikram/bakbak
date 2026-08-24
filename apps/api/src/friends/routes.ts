import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { friendController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	friendRequestIdParamsSchema,
	sendFriendRequestRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();

router.use(authMiddleware);
router.post(
	"/requests/:receiverId",
	validate(sendFriendRequestRequestSchema, "params"),
	friendController.sendRequest,
);
router.post(
	"/requests/:requestId/accept",
	validate(friendRequestIdParamsSchema, "params"),
	friendController.acceptRequest,
);

router.post(
	"/requests/:requestId/reject",
	validate(friendRequestIdParamsSchema, "params"),
	friendController.rejectRequest,
);

router.delete(
	"/requests/:requestId",
	validate(friendRequestIdParamsSchema, "params"),
	friendController.cancelRequest,
);

router.get("/", friendController.getFriends);
router.get("/requests", friendController.getPendingRequest);

router.delete("/friends/:friendId", friendController.removeFriend);

export default router;
