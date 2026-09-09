import type { Request } from "express";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";

// A request that has passed `authMiddleware`, which populates `req.user`.
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username?: string;
    role?: string;
    sessionId?: string;
  };
}

// The authenticated caller's id.
export function requireUserId(req: AuthRequest): string {
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
export function requireSessionId(req: AuthRequest): string {
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
