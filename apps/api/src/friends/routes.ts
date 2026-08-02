import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { friendController } from "../services/service.container";

const router = express.Router();

router.use(authMiddleware);
router.post("/requests/:receiverId", friendController.sendRequest);
router.post("/requests/:requestId/accept", friendController.acceptRequest);
router.post("/requests/:requestId/reject", friendController.rejectRequest);
router.delete("/requests/:requestId", friendController.cancelRequest);

router.get("/", friendController.getFriends);
router.get("/requests", friendController.getPendingRequest);

// router.delete("/friends/:friendId", friendController.removeFriend);

export default router;
