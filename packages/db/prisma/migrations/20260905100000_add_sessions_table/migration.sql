-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Session per distinct sessionId already referenced by RefreshToken,
-- so the FK constraint added below doesn't reject pre-existing rows. Session state
-- (userAgent/expiresAt/revokedAt) comes from that group's most-recently-created
-- token; createdAt from its earliest token (when the login actually started).
-- Rows with a NULL sessionId (pre-session-tracking tokens) are left untouched —
-- sessionId stays nullable, and the app lazily starts a real Session for them
-- the next time they're used to refresh.
INSERT INTO "Session" ("id", "userId", "userAgent", "createdAt", "expiresAt", "revokedAt")
SELECT DISTINCT ON (rt."sessionId")
    rt."sessionId",
    rt."userId",
    rt."userAgent",
    MIN(rt."createdAt") OVER (PARTITION BY rt."sessionId"),
    rt."expiresAt",
    rt."revokedAt"
FROM "RefreshToken" rt
WHERE rt."sessionId" IS NOT NULL
ORDER BY rt."sessionId", rt."createdAt" DESC;

-- RefreshToken no longer carries its own User-Agent — it lives on Session now.
ALTER TABLE "RefreshToken" DROP COLUMN "userAgent";

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
