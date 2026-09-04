-- Drop the retired "keep chat history" chat preference.
ALTER TABLE "UserSettings" DROP COLUMN "keepChatHistory";

-- Label refresh-token sessions with the User-Agent captured at login.
ALTER TABLE "RefreshToken" ADD COLUMN "userAgent" TEXT;
