import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { settingsController } from "../services/service.container";
import { validate } from "../middleware/validate";
import {
	updateAppearanceSettingsRequestSchema,
	updateChatPreferencesRequestSchema,
	updateNotificationSettingsRequestSchema,
	updatePrivacySettingsRequestSchema,
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
router.patch(
	"/privacy",
	validate(updatePrivacySettingsRequestSchema),
	settingsController.updatePrivacy,
);

export default router;
