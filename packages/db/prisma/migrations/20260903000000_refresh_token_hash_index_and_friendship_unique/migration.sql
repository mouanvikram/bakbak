-- Collapse any duplicate friendships (matching on the normalized pair) before
-- the unique index is added. Keeps one row per pair. No-op when there are none.
DELETE FROM "Friendship" a
USING "Friendship" b
WHERE a.ctid < b.ctid
  AND LEAST(a."user1Id", a."user2Id")   = LEAST(b."user1Id", b."user2Id")
  AND GREATEST(a."user1Id", a."user2Id") = GREATEST(b."user1Id", b."user2Id");

-- Enforce the app invariant (user1Id <= user2Id) so the unique key is stable.
UPDATE "Friendship"
SET "user1Id" = "user2Id", "user2Id" = "user1Id"
WHERE "user1Id" > "user2Id";

-- DropIndex
DROP INDEX "Friendship_user1Id_user2Id_idx";

-- CreateIndex
CREATE INDEX "Friendship_user2Id_idx" ON "Friendship"("user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_user1Id_user2Id_key" ON "Friendship"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
