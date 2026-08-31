import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { UploadService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	attachmentIdParamsSchema,
	getAttachmentResponseSchema,
	uploadResponseSchema,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	upload = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?.userId;
			const file = req.file;

			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Unauthorized",
				);
			}

			if (!file) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"No file received",
				);
			}

			const response = await this.uploadService.upload({
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

			return validateResponse(res, 201, uploadResponseSchema, {
				attachment: response,
			});
		} catch (error) {
			next(error);
		}
	};

	getAttachment = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const { attachmentId } = attachmentIdParamsSchema.parse(req.params);

			const response = await this.uploadService.getAttachment(attachmentId);

			return validateResponse(res, 200, getAttachmentResponseSchema, {
				attachment: response,
			});
		} catch (error) {
			next(error);
		}
	};

	deleteAttachment = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const { attachmentId } = attachmentIdParamsSchema.parse(req.params);
			const userId = req.user?.userId;

			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Unauthorized",
				);
			}

			await this.uploadService.delete(attachmentId, userId);

			return res.status(200).json({ id: attachmentId });
		} catch (error) {
			next(error);
		}
	};
}
