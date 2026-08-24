import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { UploadService } from "./service";
import { ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	// POST /uploads — accepts multipart form-data (or a presigned-PUT flow
	// later) and returns the created attachment.
	upload = async (req: AuthRequest, res: Response, next: NextFunction) => {
		return res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
			error: {
				code: ERROR_CODES.NOT_IMPLEMENTED,
				message: "Uploads are not implemented yet",
			},
		});
	};

	// GET /uploads/:attachmentId — returns attachment metadata (+ signed URL).
	getAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
		return res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
			error: {
				code: ERROR_CODES.NOT_IMPLEMENTED,
				message: "Attachment lookup is not implemented yet",
			},
		});
	};

	// DELETE /uploads/:attachmentId
	deleteAttachment = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		return res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
			error: {
				code: ERROR_CODES.NOT_IMPLEMENTED,
				message: "Attachment deletion is not implemented yet",
			},
		});
	};
}
