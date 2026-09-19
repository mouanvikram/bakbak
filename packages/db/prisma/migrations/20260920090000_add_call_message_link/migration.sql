-- Links a CALL message to the call it describes, so the conversation timeline
-- can render the outcome without duplicating status/duration onto the message.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "callId" UUID;

-- CreateIndex
-- Unique: a call gets at most one timeline entry.
CREATE UNIQUE INDEX "Message_callId_key" ON "Message"("callId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_callId_fkey"
  FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;
