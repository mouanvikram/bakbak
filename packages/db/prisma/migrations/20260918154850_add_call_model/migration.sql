-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'MISSED', 'DECLINED', 'FAILED');

-- CreateTable
CREATE TABLE "Call" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "callerId" UUID NOT NULL,
    "calleeId" UUID NOT NULL,
    "type" "CallType" NOT NULL DEFAULT 'AUDIO',
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_callerId_startedAt_idx" ON "Call"("callerId", "startedAt");

-- CreateIndex
CREATE INDEX "Call_calleeId_startedAt_idx" ON "Call"("calleeId", "startedAt");

-- CreateIndex
CREATE INDEX "Call_chatId_startedAt_idx" ON "Call"("chatId", "startedAt");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
