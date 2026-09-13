import { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { env } from "@/config";

// Explicit security headers rather than helmet()'s defaults. The API only
// serves JSON, so the locked-down CSP (default-src 'none') costs nothing, HSTS
// pins production TLS, and Permissions-Policy refuses unused browser features.
const baseHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  strictTransportSecurity: {
    maxAge: 31_536_000, // 1 year
    includeSubDomains: true,
    // `preload` is a promise to the HSTS-preload registry; only sign it in prod.
    ...(env.NODE_ENV === "production" ? { preload: true } : {}),
  },
});

// helmet v8 removed built-in Permissions-Policy support; set it by hand.
const permissionsPolicy = "camera=(), microphone=(), geolocation=(), browsing-topics=()";

export function securityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  baseHelmet(req, res, () => {
    res.setHeader("Permissions-Policy", permissionsPolicy);
    next();
  });
}