-- Idempotent message sends: a client-generated id, unique per sender.
ALTER TABLE "Message" ADD COLUMN "clientId" UUID;
CREATE UNIQUE INDEX "Message_senderId_clientId_key" ON "Message"("senderId", "clientId");

-- Stable session id on refresh tokens (carried across rotations) so revoking a
-- session can also disconnect that session's live sockets.
ALTER TABLE "RefreshToken" ADD COLUMN "sessionId" UUID;
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
