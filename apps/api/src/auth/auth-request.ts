import type { Request } from "express";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

// The authenticated caller's id.
export function requireUserId(req: Request): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.UNAUTHORIZED,
      "Authentication required",
    );
  }
  return userId;
}

// The session the caller's access token was minted for. See `requireUserId`.
export function requireSessionId(req: Request): string {
  const sessionId = req.user?.sessionId;
  if (!sessionId) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.UNAUTHORIZED,
      "Authentication required",
    );
  }
  return sessionId;
}
