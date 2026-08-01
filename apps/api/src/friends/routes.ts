import express from "express";

const router = express.Router();

router.post("/send");
router.post("/cancel");
router.post("/accept");
router.post("/reject")

router.get("/")
router.get("/requests")

router.delete("/friends/:friendId");

export default router;
