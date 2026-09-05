-- Case-insensitive email/username: enables citext and switches both columns
-- to it, so "User@x.com" and "user@x.com" (or two different-case usernames)
-- are the same account at the database level, not just at the app layer.
CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE "User" ALTER COLUMN "email" TYPE CITEXT;
ALTER TABLE "User" ALTER COLUMN "username" TYPE CITEXT;
