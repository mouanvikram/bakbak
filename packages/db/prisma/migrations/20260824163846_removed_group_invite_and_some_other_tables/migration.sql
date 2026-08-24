/*
  Warnings:

  - You are about to drop the column `isArchived` on the `ChatParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `isPinned` on the `ChatParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `lastReadMessageId` on the `ChatParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `leftAt` on the `ChatParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `mutedUntil` on the `ChatParticipant` table. All the data in the column will be lost.
  - You are about to drop the `Block` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Call` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EncryptionKey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupInvite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "GenderType" AS ENUM ('MALE', 'FEMALE');

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_blockedId_fkey";

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_blockerId_fkey";

-- DropForeignKey
ALTER TABLE "Call" DROP CONSTRAINT "Call_chatId_fkey";

-- DropForeignKey
ALTER TABLE "GroupInvite" DROP CONSTRAINT "GroupInvite_chatId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- AlterTable
ALTER TABLE "ChatParticipant" DROP COLUMN "isArchived",
DROP COLUMN "isPinned",
DROP COLUMN "lastReadMessageId",
DROP COLUMN "leftAt",
DROP COLUMN "mutedUntil";

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "dob" TEXT,
ADD COLUMN     "gender" "GenderType" NOT NULL DEFAULT 'MALE';

-- DropTable
DROP TABLE "Block";

-- DropTable
DROP TABLE "Call";

-- DropTable
DROP TABLE "EncryptionKey";

-- DropTable
DROP TABLE "GroupInvite";

-- DropTable
DROP TABLE "Notification";

-- DropEnum
DROP TYPE "CallStatus";

-- DropEnum
DROP TYPE "CallType";

-- DropEnum
DROP TYPE "NotificationType";
