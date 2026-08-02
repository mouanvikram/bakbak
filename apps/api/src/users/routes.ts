import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { userController } from "../services/service.container";
const router = express.Router();

router.use(authMiddleware);
router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.patch("/me/avatar", userController.updateAvatar);
router.delete("/me", userController.deleteMe);

router.get("/check-username", userController.checkUsername);
router.get("/search", userController.searchUsers);
router.get("/:username", userController.getProfile);

// router.get("/:userId/presence")
// router.get("/:userId/block");
// router.get("/:userId/block");

export default router;
