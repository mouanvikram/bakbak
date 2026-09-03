import express from "express";
import { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "@/config";
import { errorHandler } from "./middleware/error.middleware";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { rateLimiterMiddleware } from "./middleware/rate-limiter.middleware";
import authRoutes from "./auth/routes";
import userRoutes from "./users/routes";
import chatRoutes from "./chat/routes";
import friendRoutes from "./friends/routes";
import { messageRoutes } from "./messages/routes";
import settingsRoutes from "./settings/routes";
import uploadRoutes from "./uploads/routes";
import avatarRoutes from "./avatar/routes";

const app: Express = express();

app.use(requestIdMiddleware);

app.use(requestLoggerMiddleware);

app.use(rateLimiterMiddleware);

app.use(
	cors({
		origin: env.CORS_ORIGINS,
		credentials: true,
	}),
);

app.use(helmet());

app.use(compression());

app.use(express.json({ limit: "10kb" }));

// 1. Auth
app.use("/api/v1/auth", authRoutes);
// 1.0. Avatar pre-signup upload (mounted before auth routes; no auth required)
app.use("/api/v1/auth", avatarRoutes);
// 1.1. Uploads (skeleton — storage provider integration pending)
app.use("/api/v1/uploads", uploadRoutes);
// 2. Users
app.use("/api/v1/users", userRoutes);
// 2.1. Friends
app.use("/api/v1/friends", friendRoutes);
// 2.2. Settings
app.use("/api/v1/settings", settingsRoutes);
// 3. Chats (includes nested /:chatId/messages routes)
app.use("/api/v1/chats", chatRoutes);
// 4. Messages (chat-agnostic item routes: /:messageId)
app.use("/api/v1/messages", messageRoutes);
// 5. WebSocket
// 6. Notifications
// 7. Calls

app.use(errorHandler);

export default app;
