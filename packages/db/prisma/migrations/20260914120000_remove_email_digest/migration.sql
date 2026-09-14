-- The email digest preference was never wired to a sender; drop it.
ALTER TABLE "UserSettings" DROP COLUMN "emailDigest";
