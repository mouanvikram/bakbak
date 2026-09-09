import type { Response } from "express";
import { requireUserId, type AuthRequest } from "../auth/auth-request";
import type { UploadService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	deleteAttachmentResponseSchema,
	getAttachmentResponseSchema,
	uploadResponseSchema,
} from "@bakbak/contracts";
import type { AttachmentIdParamsType } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	upload = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const file = req.file;

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

		return validateResponse(res, HTTP_STATUS.CREATED, uploadResponseSchema, {
			attachment: response,
		});
	};

	getAttachment = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { attachmentId } = req.valid?.params as AttachmentIdParamsType;

		const response = await this.uploadService.getAttachment({
			attachmentId,
			userId,
		});

		return validateResponse(res, HTTP_STATUS.OK, getAttachmentResponseSchema, {
			attachment: response,
		});
	};

	deleteAttachment = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { attachmentId } = req.valid?.params as AttachmentIdParamsType;

		await this.uploadService.delete({ attachmentId, userId });

		return validateResponse(res, HTTP_STATUS.OK, deleteAttachmentResponseSchema, {
			id: attachmentId,
		});
	};
}
