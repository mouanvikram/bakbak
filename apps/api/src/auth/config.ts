import { bool } from "@/config/parse";
import { isProduction, requiredInProduction } from "@/config/required";

const ONE_HOUR_MS = 60 * 60 * 1000;

// SameSite for the refresh cookie. "strict" fits the web app reaching the API
// same-origin (Vite proxy in dev, a rewrite in prod); "none" is only for a
// cross-site API, and browsers require Secure alongside it.
function parseSameSite(raw: string | undefined): "strict" | "lax" | "none" {
  const value = raw?.trim().toLowerCase();
  return value === "lax" || value === "none" ? value : "strict";
}

const refreshCookieSameSite = parseSameSite(process.env.AUTH_COOKIE_SAMESITE);

export const authConfig = {
  // Base for verification / reset / recovery links in outbound email, so a
  // localhost value surviving into production sends users dead links.
  frontendUrl: requiredInProduction(process.env.FRONTEND_URL, "FRONTEND_URL", {
    insecureDevDefault: "http://localhost:5173",
  }),
  refreshTokenExpiryDays: 7,
  // A refresh token rotated this recently is refused without triggering reuse
  // detection: inside the window a replay is almost always a benign race (two
  // tabs, a retried request whose response was lost), not a stolen token.
  refreshTokenReuseGraceMs: 30_000,
  // The refresh token travels only in this httpOnly cookie, scoped to the auth
  // routes, so page scripts — and any XSS — can never read it.
  refreshCookie: {
    name: "bakbak_rt",
    path: "/api/v1/auth/refresh-token",
    sameSite: refreshCookieSameSite,
    secure:
      refreshCookieSameSite === "none" ||
      bool(process.env.AUTH_COOKIE_SECURE, isProduction()),
  },
  verificationTokenTtlMs: ONE_HOUR_MS,
  passwordResetTokenTtlMs: ONE_HOUR_MS,
  accountRecoveryWindowMs: 30 * 24 * 60 * 60 * 1000,
  dummyPasswordHash:
    "$argon2id$v=19$m=65536,t=3,p=1$O33CfCzMnDsgKMk96pdnpiDwdAHBcp0kBtscfTiFe5E$RGazuyPBViMxQ/tuHPhhiz3lPxuoIf8FnCMGZDaDLlM",
  passwordHashing: {
    algorithm: "argon2id",
    timeCost: 3,
    memoryCost: 65536,
  } as const,
  twoFactor: {
    codeTtlMinutes: 10,
    challengeTtl: "10m" as const,
    maxAttempts: 10,
    lockoutMs: 4 * 60 * 60 * 1000,
  },
};
