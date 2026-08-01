import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { friendController } from "../services/service.container";

const router = express.Router();

router.use(authMiddleware);
router.post("/send", friendController.sendRequest);
router.post("/cancel", friendController.cancelRequest);
router.post("/accept", friendController.acceptRequest);
router.post("/reject", friendController.rejectRequest);

router.get("/", friendController.getFriends);
router.get("/requests", friendController.getPendingRequest);

router.delete("/friends/:friendId", friendController.removeFriend);

export default router;
