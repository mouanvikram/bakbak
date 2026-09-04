import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { SettingsService } from "./service";
import { validateResponse } from "../middleware/validate";
import { userSettingsResponseSchema } from "@bakbak/contracts";

export class SettingsController {
	constructor(private readonly settingsService: SettingsService) {}

	getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				});
			}

			const response = await this.settingsService.getSettings(userId);

			return validateResponse(res, 200, userSettingsResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	updateNotifications = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				});
			}

			const response = await this.settingsService.updateNotifications(
				userId,
				req.body,
			);

			return validateResponse(res, 200, userSettingsResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	updateAppearance = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				});
			}

			const response = await this.settingsService.updateAppearance(
				userId,
				req.body,
			);

			return validateResponse(res, 200, userSettingsResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	updateChatPreferences = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				return res.status(401).json({
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
				});
			}

			const response = await this.settingsService.updateChatPreferences(
				userId,
				req.body,
			);

			return validateResponse(res, 200, userSettingsResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};
}
