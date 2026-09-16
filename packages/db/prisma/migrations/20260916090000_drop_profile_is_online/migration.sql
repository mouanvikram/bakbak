-- Online state is Redis presence + socket events; the column was written but
-- never read, and went stale whenever an API server died.
ALTER TABLE "UserProfile" DROP COLUMN "isOnline";

-- "Last seen" now starts at signup rather than at the first disconnect.
ALTER TABLE "UserProfile" ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;
