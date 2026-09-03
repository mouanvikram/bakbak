import multer from "multer";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { kindFromMime } from "../uploads/file-type";

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: MAX_FILE_SIZE,
		files: 1,
	},
	fileFilter: (_req, file, cb) => {
		const kind = kindFromMime(file.mimetype);
		if (!kind) {
			return cb(
				new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
					`Unsupported file type: ${file.mimetype}`,
				),
			);
		}
		cb(null, true);
	},
});

export const uploadMiddleware = upload.single("file");

export const multerErrorHandler = (
	err: unknown,
	_req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	if (err instanceof multer.MulterError) {
		if (err.code === "LIMIT_FILE_SIZE") {
			return next(
				new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.FILE_TOO_LARGE,
					"File exceeds the 25 MB limit",
				),
			);
		}
		return next(
			new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				err.message,
			),
		);
	}
	return next(err);
};
