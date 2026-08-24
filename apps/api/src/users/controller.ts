import type { AuthRequest } from "../auth/controller";
import type { Response } from "express";
import type { UserService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	checkUsernameResponseSchema,
	deleteMeResponseSchema,
	getMeResponseSchema,
	getProfileResponseSchema,
	searchUsersResponseSchema,
	updateAvatarResponseSchema,
	updateProfileResponseSchema,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export class UserController {
	constructor(private readonly userService: UserService) {}

	getMe = async (req: AuthRequest, res: Response) => {
		const userId = req.user?.userId;
		if (!userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.USER_ID_NOT_VALID,
				"",
			);
		}
		const profile = await this.userService.getMe({
			userId,
		});

		return validateResponse(res, 200, getMeResponseSchema, profile);
	};

	updateMe = async (req: AuthRequest, res: Response) => {
		const { bio, firstName, lastName, displayName } = req.body;
		const userId = req.user?.userId;

		if (!userId) {
			return res.status(400).json({
				error: "Enter a valid user id",
			});
		}

		const response = await this.userService.updateMe({
			userId,
			bio,
			firstName,
			lastName,
			displayName,
		});

		return validateResponse(res, 200, updateProfileResponseSchema, response);
	};

	updateAvatar = async (req: AuthRequest, res: Response) => {
		const { avatar } = req.body;
		const userId = req.user?.userId;

		if (!userId) {
			return res.status(400).json({
				error: "Enter a valid user id",
			});
		}
		const response = await this.userService.updateAvatar({
			userId,
			avatar,
		});

		return validateResponse(res, 200, updateAvatarResponseSchema, response);
	};

	deleteMe = async (req: AuthRequest, res: Response) => {
		const userId = req.user?.userId;

		if (!userId) {
			return res.status(400).json({
				error: "Enter a valid user id",
			});
		}
		await this.userService.deleteMe({
			userId,
		});

		return validateResponse(res, 200, deleteMeResponseSchema, {
			message: "Account Deleted successfully",
		});
	};

	searchUsers = async (req: AuthRequest, res: Response) => {
		const { query } = req.query;
		if (typeof query !== "string") {
			return res.status(400).json({
				error: "Validation failed",
			});
		}
		const response = await this.userService.searchUsers({
			query,
		});

		return validateResponse(res, 200, searchUsersResponseSchema, response);
	};

	getProfile = async (req: AuthRequest, res: Response) => {
		const { username } = req.params;
		if (typeof username !== "string" || !username) {
			return res.status(400).json({
				message: "invalid request",
			});
		}
		const otherUserProfile = await this.userService.getProfile({ username });

		return validateResponse(res, 200, getProfileResponseSchema, {
			...otherUserProfile,
			username,
		});
	};

	checkUsername = async (req: AuthRequest, res: Response) => {
		const username = req.query.username;

		if (typeof username !== "string") {
			return res.status(400).json({
				message: "invalid request",
			});
		}

		const response = await this.userService.checkUsername({
			username,
		});

		return validateResponse(res, 200, checkUsernameResponseSchema, response);
	};
}
