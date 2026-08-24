-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" UUID NOT NULL,
    "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
    "notifySounds" BOOLEAN NOT NULL DEFAULT true,
    "notifyAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(10) NOT NULL DEFAULT 'system',
    "fontSize" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "enterToSend" BOOLEAN NOT NULL DEFAULT true,
    "mediaPreview" BOOLEAN NOT NULL DEFAULT true,
    "keepChatHistory" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
