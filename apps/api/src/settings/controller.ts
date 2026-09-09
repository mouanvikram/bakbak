import type { Response } from "express";
import { requireUserId, type AuthRequest } from "../auth/auth-request";
import type { SettingsService } from "./service";
import { validateResponse } from "../middleware/validate";
import { userSettingsResponseSchema } from "@bakbak/contracts";
import type {
	AppearanceSettingsType,
	ChatPreferencesType,
	NotificationSettingsType,
} from "@bakbak/contracts";
import { HTTP_STATUS } from "@/errors/app-error";

export class SettingsController {
	constructor(private readonly settingsService: SettingsService) {}

	getSettings = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.getSettings({ userId });

		return validateResponse(res, HTTP_STATUS.OK, userSettingsResponseSchema, response);
	};

	updateNotifications = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.updateNotifications({
			userId,
			settings: req.valid?.body as NotificationSettingsType,
		});

		return validateResponse(res, HTTP_STATUS.OK, userSettingsResponseSchema, response);
	};

	updateAppearance = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.updateAppearance({
			userId,
			settings: req.valid?.body as AppearanceSettingsType,
		});

		return validateResponse(res, HTTP_STATUS.OK, userSettingsResponseSchema, response);
	};

	updateChatPreferences = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.updateChatPreferences({
			userId,
			settings: req.valid?.body as ChatPreferencesType,
		});

		return validateResponse(res, HTTP_STATUS.OK, userSettingsResponseSchema, response);
	};
}
