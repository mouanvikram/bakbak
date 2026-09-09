import { positiveNum } from "@/config/parse";

export const usersConfig = {
  loginMaxAttempts: positiveNum(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginLockoutMs: positiveNum(process.env.LOGIN_LOCKOUT_MS, 15 * 60 * 1000),
};
