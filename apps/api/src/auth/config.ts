import { requiredInProduction } from "@/config/required";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const authConfig = {
  // Base for verification / reset / recovery links in outbound email, so a
  // localhost value surviving into production sends users dead links.
  frontendUrl: requiredInProduction(
    process.env.FRONTEND_URL,
    "FRONTEND_URL",
    { insecureDevDefault: "http://localhost:5173" },
  ),
  refreshTokenExpiryDays: 7,
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
