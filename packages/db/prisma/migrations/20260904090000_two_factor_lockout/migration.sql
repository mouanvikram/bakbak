-- Brute-force protection for 2FA code verification: lock after repeated
-- wrong codes, same shape as the existing login lockout.
ALTER TABLE "User" ADD COLUMN     "twoFactorFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twoFactorLockedUntil" TIMESTAMP(3);
