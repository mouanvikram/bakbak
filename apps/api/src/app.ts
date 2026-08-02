import express from "express";
import { type Express } from "express";
import authRoutes from "./auth/routes";
import userRoutes from "./users/routes";
import chatRoutes from "./chat/routes";
import chatMessageRoutes from "./messages/chat.message.routes";
import friendRoutes from "./friends/routes";
import messageRoutes from "./messages/routes";

const app: Express = express();
app.use(express.json());

// 1. Auth
app.use("/api/auth", authRoutes);
// 2. Users
app.use("/users", userRoutes);
// 2.1. Friends
app.use("/friends", friendRoutes);
// 3. Chats
app.use("/chats", chatRoutes);
app.use("/chats", chatMessageRoutes);
// 4. Messages
// app.use("/api/messages", messageRoutes);
// 5. WebSocket
// 6. Attachments
// 7. Notifications
// 8. Calls

export default app;
