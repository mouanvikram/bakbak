import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { pushController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import { pushSubscriptionRequestSchema } from "@bakbak/contracts";

export const pushRoutes = Router();

// Public sooner than the auth wall: the SPA reads it before/while logging in
// to decide whether to enable the toggle at all.
pushRoutes.get("/config", pushController.getConfig);

pushRoutes.use(authMiddleware);

pushRoutes.post(
  "/subscribe",
  validate(pushSubscriptionRequestSchema),
  pushController.subscribe,
);
pushRoutes.post(
  "/unsubscribe",
  validate(pushSubscriptionRequestSchema),
  pushController.unsubscribe,
);