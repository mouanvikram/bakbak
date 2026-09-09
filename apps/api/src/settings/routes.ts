import { Router } from "express";
import { authMiddleware } from "@/middleware/auth.middleware";
import { settingsController } from "@/services/service.container";
import { validate } from "@/middleware/validate";
import {
	updateAppearanceSettingsRequestSchema,
	updateChatPreferencesRequestSchema,
	updateNotificationSettingsRequestSchema,
} from "@bakbak/contracts";

export const settingsRoutes = Router();

settingsRoutes.use(authMiddleware);

settingsRoutes.get("/", settingsController.getSettings);
settingsRoutes.patch(
	"/notifications",
	validate(updateNotificationSettingsRequestSchema),
	settingsController.updateNotifications,
);
settingsRoutes.patch(
	"/appearance",
	validate(updateAppearanceSettingsRequestSchema),
	settingsController.updateAppearance,
);
settingsRoutes.patch(
	"/chat",
	validate(updateChatPreferencesRequestSchema),
	settingsController.updateChatPreferences,
);

// 2FA (the only "privacy" setting) is managed through /auth/2fa/* so the
// change can be verified with an emailed code — see auth routes.
