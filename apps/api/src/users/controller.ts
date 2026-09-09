import { requireUserId, type AuthRequest } from "../auth/auth-request";
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
import type {
	CheckUsernameRequestType,
	GetProfileRequestType,
	SearchUsersRequestType,
	UpdateAvatarRequestType,
	UpdateProfileRequestType,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

export class UserController {
	constructor(private readonly userService: UserService) {}

	getMe = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const profile = await this.userService.getMe({
			userId,
		});

		return validateResponse(res, HTTP_STATUS.OK, getMeResponseSchema, profile);
	};

	updateMe = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { username, bio, firstName, lastName, displayName } = req.valid
			?.body as UpdateProfileRequestType;

		const response = await this.userService.updateMe({
			userId,
			username,
			bio,
			firstName,
			lastName,
			displayName,
		});

		return validateResponse(res, HTTP_STATUS.OK, updateProfileResponseSchema, response);
	};

	updateAvatar = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { avatar } = req.valid?.body as UpdateAvatarRequestType;

		const response = await this.userService.updateAvatar({
			userId,
			avatar,
		});

		return validateResponse(res, HTTP_STATUS.OK, updateAvatarResponseSchema, response);
	};

	uploadAvatar = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const file = req.file;

		if (!file) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"No avatar file received",
			);
		}

		const response = await this.userService.uploadAvatar({
			userId,
			file: {
				fieldname: file.fieldname,
				originalname: file.originalname,
				encoding: file.encoding,
				mimetype: file.mimetype,
				buffer: file.buffer,
				size: file.size,
			},
		});

		return validateResponse(res, HTTP_STATUS.OK, updateAvatarResponseSchema, response);
	};

	deleteMe = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		await this.userService.deleteMe({
			userId,
		});

		return validateResponse(res, HTTP_STATUS.OK, deleteMeResponseSchema, {
			message: "Account Deleted successfully",
		});
	};

	searchUsers = async (req: AuthRequest, res: Response) => {
		const { query } = req.valid?.query as SearchUsersRequestType;

		const response = await this.userService.searchUsers({
			query,
		});

		return validateResponse(res, HTTP_STATUS.OK, searchUsersResponseSchema, response);
	};

	getProfile = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { username } = req.valid?.params as GetProfileRequestType;

		const otherUserProfile = await this.userService.getProfile({
			username,
			currentUserId,
		});

		return validateResponse(
			res,
			HTTP_STATUS.OK,
			getProfileResponseSchema,
			otherUserProfile,
		);
	};

	checkUsername = async (req: AuthRequest, res: Response) => {
		const { username } = req.valid?.query as CheckUsernameRequestType;

		const response = await this.userService.checkUsername({
			username,
		});

		return validateResponse(res, HTTP_STATUS.OK, checkUsernameResponseSchema, response);
	};
}
