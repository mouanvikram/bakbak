-- AlterTable
ALTER TABLE "ChatParticipant" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastReadMessageId" TEXT,
ADD COLUMN     "leftAt" TIMESTAMP(3),
ADD COLUMN     "mutedUntil" TIMESTAMP(3);
