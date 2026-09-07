import multer from "multer";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { uploadsConfig } from "../uploads/config";

export const avatarUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: uploadsConfig.maxAvatarSize,
		files: 1,
	},
	fileFilter: (_req, file, cb) => {
		if (!uploadsConfig.allowedAvatarMime.includes(file.mimetype)) {
			return cb(
				new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
					"Avatar must be a JPEG, PNG, WebP, AVIF, GIF or BMP image",
				),
			);
		}
		cb(null, true);
	},
});

export const avatarUploadMiddleware = avatarUpload.single("file");

export const avatarMulterErrorHandler = (
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
					"Avatar exceeds the 10 MB limit",
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
