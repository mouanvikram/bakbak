-- Backfill: 32 pre-idempotent-send Message rows predate the clientId feature
-- and were never given one. Give each a generated id so the column can become
-- required below without losing those rows.
UPDATE "Message" SET "clientId" = gen_random_uuid() WHERE "clientId" IS NULL;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "clientId" SET NOT NULL;

-- Replies: a message may reference the message it's replying to.
ALTER TABLE "Message" ADD COLUMN "replyToId" UUID;

-- Editing: when a message's text was last changed.
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);

-- `deletedAt` alone now marks a soft-deleted message; the boolean was redundant.
ALTER TABLE "Message" DROP COLUMN "deleted";

-- CreateIndex
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
