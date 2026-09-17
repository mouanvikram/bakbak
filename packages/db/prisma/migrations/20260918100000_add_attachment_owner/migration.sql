-- Attachments now record their owner explicitly, so a user's stored bytes can
-- be summed against their quota without scanning storage keys.
ALTER TABLE "Attachment" ADD COLUMN "ownerId" UUID;

-- Chat attachments are keyed "<userId>/<uuid>", so existing rows backfill from
-- that prefix. Signup avatars live under "avatars/" and have no owner to
-- recover — they stay null and don't count against anyone's quota.
UPDATE "Attachment"
SET "ownerId" = substring(
  "filePath" from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
)::uuid
WHERE "filePath" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/';

CREATE INDEX "Attachment_ownerId_idx" ON "Attachment"("ownerId");
