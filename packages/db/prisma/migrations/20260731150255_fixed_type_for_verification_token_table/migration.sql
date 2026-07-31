/*
  Warnings:

  - Changed the type of `type` on the `VerificationToken` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "VerificationToken" DROP COLUMN "type",
ADD COLUMN     "type" "VerificationTokenType" NOT NULL;

-- DropEnum
DROP TYPE "SentEmailType";

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_userId_type_key" ON "VerificationToken"("userId", "type");
