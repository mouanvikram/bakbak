import multer from "multer";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { kindFromMime } from "@/uploads/file-type";
import { uploadsConfig } from "@/uploads/config";

interface FileUploadOptions {
	field?: string;
	label: string;
	maxFileSize: number;
	rejectReason: (file: Express.Multer.File) => string | null;
}

interface FileUpload {
	// Buffers a single file onto `req.file`.
	middleware: RequestHandler;
	errorHandler: ErrorRequestHandler;
}

function formatLimit(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

// Builds a memory-backed single-file upload and its paired error handler.

export function createFileUpload(options: FileUploadOptions): FileUpload {
	const { field = "file", label, maxFileSize, rejectReason } = options;

	const instance = multer({
		storage: multer.memoryStorage(),
		limits: {
			fileSize: maxFileSize,
			files: 1,
		},
		fileFilter: (_req, file, cb) => {
			const reason = rejectReason(file);
			if (reason) {
				return cb(
					new AppError(
						HTTP_STATUS.BAD_REQUEST,
						ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
						reason,
					),
				);
			}
			cb(null, true);
		},
	});

	const errorHandler: ErrorRequestHandler = (err, _req, _res, next) => {
		if (err instanceof multer.MulterError) {
			if (err.code === "LIMIT_FILE_SIZE") {
				return next(
					new AppError(
						HTTP_STATUS.BAD_REQUEST,
						ERROR_CODES.FILE_TOO_LARGE,
						`${label} exceeds the ${formatLimit(maxFileSize)} limit`,
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

	return { middleware: instance.single(field), errorHandler };
}

// Profile and signup avatars — images only, tighter cap.
export const avatarUpload = createFileUpload({
	label: "Avatar",
	maxFileSize: uploadsConfig.maxAvatarSize,
	rejectReason: (file) =>
		uploadsConfig.allowedAvatarMime.includes(file.mimetype)
			? null
			: "Avatar must be a JPEG, PNG, WebP, AVIF, GIF or BMP image",
});

// Chat attachments — any MIME that maps to a known AttachmentKind.
export const attachmentUpload = createFileUpload({
	label: "File",
	maxFileSize: uploadsConfig.maxFileSize,
	rejectReason: (file) =>
		kindFromMime(file.mimetype)
			? null
			: `Unsupported file type: ${file.mimetype}`,
});
