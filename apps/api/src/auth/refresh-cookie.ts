import type { CookieOptions, NextFunction, Request, Response } from "express";
import { env } from "@/config";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { authConfig } from "./config";

const { name, path, sameSite, secure } = authConfig.refreshCookie;

const MAX_AGE_MS = authConfig.refreshTokenExpiryDays * 24 * 60 * 60 * 1000;
// Same ceiling the old body field enforced; a real token is 64 hex chars.
const MAX_TOKEN_LENGTH = 255;

const baseOptions: CookieOptions = { httpOnly: true, secure, sameSite, path };

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(name, token, { ...baseOptions, maxAge: MAX_AGE_MS });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(name, baseOptions);
}

/**
 * The refresh token from the request's cookie, or null. Express 5 ships no
 * cookie parser, and this is the only cookie the API reads.
 */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value && value.length <= MAX_TOKEN_LENGTH ? value : null;
  }
  return null;
}

/**
 * CSRF guard for cookie-authenticated routes. Browsers send `Origin` on every
 * POST, so a page on a foreign site is refused before the cookie is used.
 * Requests without `Origin` come from non-browser clients, which a malicious
 * page can't drive.
 */
export function requireTrustedOrigin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const origin = req.headers.origin;
  if (!origin || env.CORS_ORIGINS.includes(origin)) return next();

  next(
    new AppError(
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.FORBIDDEN,
      "Untrusted origin",
    ),
  );
}
