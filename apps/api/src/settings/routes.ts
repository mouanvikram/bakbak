import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { settingsController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	updateAppearanceSettingsRequestSchema,
	updateChatPreferencesRequestSchema,
	updateNotificationSettingsRequestSchema,
} from "@bakbak/contracts";

const router = express.Router();

router.use(authMiddleware);

router.get("/", settingsController.getSettings);
router.patch(
	"/notifications",
	validate(updateNotificationSettingsRequestSchema),
	settingsController.updateNotifications,
);
router.patch(
	"/appearance",
	validate(updateAppearanceSettingsRequestSchema),
	settingsController.updateAppearance,
);
router.patch(
	"/chat",
	validate(updateChatPreferencesRequestSchema),
	settingsController.updateChatPreferences,
);

// 2FA (the only "privacy" setting) is managed through /auth/2fa/* so the
// change can be verified with an emailed code — see auth routes.

export default router;
