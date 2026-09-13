import { type NextFunction, type Request, type Response } from "express";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

// Content types express.json doesn't parse — capped by the form body limit
// instead of the 32kb JSON cap.
const FORM_CONTENT_TYPES = new Set([
  "multipart/form-data",
  "application/x-www-form-urlencoded",
]);

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

// Caps form bodies before any parser sees them. A bounding Content-Length
// yields an immediate 413; chunked form bodies are refused outright because
// real browsers/clients always send Content-Length for forms, and without it
// there is no way to cap the stream before the handler has already replied.
export function formBodySizeLimit(maxBytes: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const encodedType =
      typeof req.headers["content-type"] === "string"
        ? req.headers["content-type"]
        : "";
    const type = (encodedType.split(";")[0] ?? "")
      .trim()
      .toLowerCase();
    if (!FORM_CONTENT_TYPES.has(type)) return next();

    const lengthHeader = req.headers["content-length"];
    const contentLength =
      typeof lengthHeader === "string" ? Number(lengthHeader) : NaN;

    if (!Number.isFinite(contentLength)) {
      return next(
        new AppError(
          HTTP_STATUS.PAYLOAD_TOO_LARGE,
          ERROR_CODES.PAYLOAD_TOO_LARGE,
          "Form bodies must include a Content-Length header",
        ),
      );
    }

    if (contentLength > maxBytes) {
      return next(
        new AppError(
          HTTP_STATUS.PAYLOAD_TOO_LARGE,
          ERROR_CODES.PAYLOAD_TOO_LARGE,
          `Request body exceeds the ${megabytes(maxBytes)} limit`,
        ),
      );
    }

    return next();
  };
}