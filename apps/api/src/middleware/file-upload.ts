import multer from "multer";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import {
  contentMatchesKind,
  extensionFrom,
  kindFromExtension,
  kindFromMime,
} from "@/uploads/file-type";
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

/**
 * Rejects a buffered file whose bytes don't identify it as the kind its
 * declared MIME (or failing that, its extension) claims — an executable posted
 * as `image/png`, say. The declared type is only a hint; this is the check that
 * the content agrees with it.
 */
function contentMismatch(file: Express.Multer.File): string | null {
  const claimed =
    kindFromMime(file.mimetype) ??
    kindFromExtension(extensionFrom(file.originalname));

  return contentMatchesKind(file.buffer, claimed)
    ? null
    : `File content does not match its declared type (${file.mimetype})`;
}

// Builds a memory-backed single-file upload and its paired error handler.

function createFileUpload(options: FileUploadOptions): FileUpload {
  const { field = "file", label, maxFileSize, rejectReason } = options;

  const instance = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
      files: 1,
      // Non-file fields: cap each and cap the count, so a multipart body full of fields can't bypass the file cap to balloon memory.
      fieldSize: 128 * 1024,
      fields: 16,
      parts: 18,
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

  // The filter above only sees the declared MIME, which the client controls.
  // Sniffing needs the whole buffer, so it runs once multer has it.
  const single = instance.single(field);
  const middleware: RequestHandler = (req, res, next) => {
    single(req, res, (err: unknown) => {
      if (err) return next(err);
      if (!req.file) return next();

      const reason = contentMismatch(req.file);
      if (reason) {
        return next(
          new AppError(
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
            reason,
          ),
        );
      }
      next();
    });
  };

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

  return { middleware, errorHandler };
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
