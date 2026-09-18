import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { callsController } from "@/services/service.container";

export const callsRoutes = Router();

// Authenticated, unlike GET /push/config: that endpoint hands out a public
// VAPID key, whereas this one hands out working TURN credentials. Anyone
// holding a pair can relay traffic through the server until it expires.
callsRoutes.use(authMiddleware);

callsRoutes.get("/ice-servers", callsController.getIceServers);
callsRoutes.get("/history", callsController.getHistory);
