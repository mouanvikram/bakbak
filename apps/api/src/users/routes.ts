import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authMiddleware);
router.get("/me");
router.patch("/me");
router.patch("/me/avatar");
router.delete("/me");

router.get(":username");
router.get("/check-username?username=");
router.get("/serach?q=");

// //update profile pic
// router.post("/me/avatar");
// router.patch("/me/avatar");

// router.get("/:userId/presence")
// router.get("/:userId/block");
// router.get("/:userId/block");

export default router;
