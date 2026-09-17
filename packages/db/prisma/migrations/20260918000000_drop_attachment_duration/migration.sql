-- Audio/video duration was never extracted — the column was created, always
-- written null, and served as null. Reading it needs a media probe we don't
-- run, so drop it rather than keep an empty field in the API contract.
ALTER TABLE "Attachment" DROP COLUMN "duration";
