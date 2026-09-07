import express from "express";
import { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "@/config";
import { errorHandler } from "./middleware/error.middleware";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { rateLimitGlobal } from "./redis/rate-limit";
import authRoutes from "./auth/routes";
import userRoutes from "./users/routes";
import chatRoutes from "./chat/routes";
import friendRoutes from "./friends/routes";
import { messageRoutes } from "./messages/routes";
import settingsRoutes from "./settings/routes";
import uploadRoutes from "./uploads/routes";
import systemRoutes from "./system/routes";

const app: Express = express();

app.use(requestIdMiddleware);

app.use(requestLoggerMiddleware);

// Redis token-bucket global ceiling per IP (per-route buckets ride along
// on their own routes; the in-memory limiter remains in
// middleware/rate-limiter.middleware as the documented no-Redis fallback).
app.use(rateLimitGlobal());

app.use(
	cors({
		origin: env.CORS_ORIGINS,
		credentials: true,
	}),
);

app.use(helmet());

app.use(compression());

// 32kb fully covers a schema-max 5000-char message in any multi-byte script
// (CJK ~3 B/char, emoji ~4 B/char) while staying small enough to ignore as a
// DoS vector. Every other JSON body is well under 10kb.
app.use(express.json({ limit: "32kb" }));

// Public build/version info (used by the client to spot a stale bundle)
app.use("/api/v1/version", systemRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/settings", settingsRoutes);
// Chats (includes nested /:chatId/messages routes)
app.use("/api/v1/chats", chatRoutes);
// Messages (chat-agnostic item routes: /:messageId)
app.use("/api/v1/messages", messageRoutes);

app.use(errorHandler);

export default app;
