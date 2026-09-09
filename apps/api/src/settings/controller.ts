import type { Response } from "express";
import { requireUserId, type AuthRequest } from "../auth/auth-request";
import type { SettingsService } from "./service";
import { validateResponse } from "../middleware/validate";
import { userSettingsResponseSchema } from "@bakbak/contracts";

export class SettingsController {
	constructor(private readonly settingsService: SettingsService) {}

	getSettings = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.getSettings(userId);

		return validateResponse(res, 200, userSettingsResponseSchema, response);
	};

	updateNotifications = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.updateNotifications(
			userId,
			req.body,
		);

		return validateResponse(res, 200, userSettingsResponseSchema, response);
	};

	updateAppearance = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.updateAppearance(
			userId,
			req.body,
		);

		return validateResponse(res, 200, userSettingsResponseSchema, response);
	};

	updateChatPreferences = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.settingsService.updateChatPreferences(
			userId,
			req.body,
		);

		return validateResponse(res, 200, userSettingsResponseSchema, response);
	};
}
