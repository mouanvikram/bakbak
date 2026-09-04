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
		const userId = req.user?.userId;
		if (!userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.USER_ID_NOT_VALID,
				"Enter a valid user id",
			);
		}
		const profile = await this.userService.getMe({
			userId,
		});

		return validateResponse(res, 200, getMeResponseSchema, profile);
	};

	updateMe = async (req: AuthRequest, res: Response) => {
		const { username, bio, firstName, lastName, displayName } =
			req.valid?.body as UpdateProfileRequestType;
		const userId = req.user?.userId;

		if (!userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.USER_ID_NOT_VALID,
				"Enter a valid user id",
			);
		}

		const response = await this.userService.updateMe({
			userId,
			username,
			bio,
			firstName,
			lastName,
			displayName,
		});

		return validateResponse(res, 200, updateProfileResponseSchema, response);
	};

	updateAvatar = async (req: AuthRequest, res: Response) => {
		const { avatar } = req.valid?.body as UpdateAvatarRequestType;
		const userId = req.user?.userId;

		if (!userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.USER_ID_NOT_VALID,
				"Enter a valid user id",
			);
		}
		const response = await this.userService.updateAvatar({
			userId,
			avatar,
		});

		return validateResponse(res, 200, updateAvatarResponseSchema, response);
	};

	uploadAvatar = async (req: AuthRequest, res: Response) => {
		const userId = req.user?.userId;
		const file = req.file;

		if (!userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.USER_ID_NOT_VALID,
				"Enter a valid user id",
			);
		}
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

		return validateResponse(res, 200, updateAvatarResponseSchema, response);
	};

	deleteMe = async (req: AuthRequest, res: Response) => {
		const userId = req.user?.userId;

		if (!userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.USER_ID_NOT_VALID,
				"Enter a valid user id",
			);
		}
		await this.userService.deleteMe({
			userId,
		});

		return validateResponse(res, 200, deleteMeResponseSchema, {
			message: "Account Deleted successfully",
		});
	};

	searchUsers = async (req: AuthRequest, res: Response) => {
		const { query } = req.valid?.query as SearchUsersRequestType;
		const response = await this.userService.searchUsers({
			query,
		});

		return validateResponse(res, 200, searchUsersResponseSchema, response);
	};

	getProfile = async (req: AuthRequest, res: Response) => {
		const { username } = req.valid?.params as GetProfileRequestType;
		const currentUserId = req.user?.userId;
		if (!currentUserId) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.UNAUTHORIZED,
				"Authentication required",
			);
		}

		const otherUserProfile = await this.userService.getProfile({
			username,
			currentUserId,
		});

		return validateResponse(res, 200, getProfileResponseSchema, otherUserProfile);
	};

	checkUsername = async (req: AuthRequest, res: Response) => {
		const { username } = req.valid?.query as CheckUsernameRequestType;
		const response = await this.userService.checkUsername({
			username,
		});

		return validateResponse(res, 200, checkUsernameResponseSchema, response);
	};
}
