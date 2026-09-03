import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { AvatarTokenStore } from "./avatar-token.store";
import { validateResponse } from "../middleware/validate";
import { avatarUploadResponseSchema } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

export class AvatarController {
	constructor(private readonly avatarTokenStore: AvatarTokenStore) {}

	upload = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const file = req.file;

			if (!file) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"No avatar file received",
				);
			}

			const { avatarToken } = this.avatarTokenStore.put({
				fieldname: file.fieldname,
				originalname: file.originalname,
				encoding: file.encoding,
				mimetype: file.mimetype,
				buffer: file.buffer,
				size: file.size,
			});

			return validateResponse(
				res,
				HTTP_STATUS.CREATED,
				avatarUploadResponseSchema,
				{ avatarToken },
			);
		} catch (error) {
			next(error);
		}
	};
}
