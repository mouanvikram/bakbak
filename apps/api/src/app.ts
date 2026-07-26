import express from "express";
import { type Express } from "express";
import authRoutes from "./auth/routes";
import chatRoutes from "./chat/routes";
import userRoutes from "./users/routes";
import messageRoutes from "./messages/routes";

const app: Express = express();
app.use(express.json());

// 1. Auth
app.use("/api/auth", authRoutes);
// 2. Users
app.use("/api/users",userRoutes);
// 3. Messages
app.use("/api/messages",messageRoutes);
// 4. Chats
app.use("/api/chats", chatRoutes);
// 5. WebSocket
// 6. Attachments
// 7. Notifications
// 8. Calls

export default app;
