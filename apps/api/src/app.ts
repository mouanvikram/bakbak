import express from "express";
import { type Express } from "express";
import cors from "cors";
import { env } from "../lib/config";
import { errorHandler } from "./middleware/error.middleware";
import authRoutes from "./auth/routes";
import userRoutes from "./users/routes";
import chatRoutes from "./chat/routes";
import chatMessageRoutes from "./messages/chat.message.routes";
import friendRoutes from "./friends/routes";
import messageRoutes from "./messages/routes";

const app: Express = express();

app.use(
	cors({
		origin: env.CORS_ORIGINS,
		credentials: true,
	}),
);
app.use(express.json());

// 1. Auth
app.use("/api/v1/auth", authRoutes);
// 2. Users
app.use("/api/v1/users", userRoutes);
// 2.1. Friends
app.use("/api/v1/friends", friendRoutes);
// 3. Chats
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/chats", chatMessageRoutes);
// 4. Messages
app.use("/api/v1/messages", messageRoutes);
// 5. WebSocket
// 6. Attachments
// 7. Notifications
// 8. Calls

app.use(errorHandler);

export default app;
