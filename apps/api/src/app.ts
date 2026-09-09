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

// 1. Reverse-proxy awareness
app.set("trust proxy", env.TRUST_PROXY);

// 2. Security headers
app.use(helmet());

// 3. CORS
app.use(
	cors({
		origin: env.CORS_ORIGINS,
		credentials: true,
	}),
);

// 4. Request identity
app.use(requestIdMiddleware);

// 5. Request logging
app.use(requestLoggerMiddleware);

// 6. Request body parsing
app.use(express.json({ limit: "32kb" }));

// 7. Global rate limiting
app.use(rateLimitGlobal());

// 8. Response compression
app.use(compression());

// 9. Routes
app.use("/api/v1/version", systemRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/messages", messageRoutes);

// 10. Error handler
app.use(errorHandler);

export default app;
