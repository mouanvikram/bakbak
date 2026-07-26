import express from "express";
import { type Express } from "express";
import authRoutes from "./auth/routes";
import conversationRoutes from "./conversation/routes";
import { logger } from "../lib/logger";

const app: Express = express();
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);

export default app;
