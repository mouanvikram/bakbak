// Storage backend connection, signed-URL TTLs, and upload size / type guards (enforced by the multer middlewares).
import { bool, positiveNum, str } from "@/config/parse";
import { requiredInProduction, warnInProduction } from "@/config/required";

const SIGNED_URL_TTL_SECONDS = positiveNum(
  process.env.SIGNED_URL_TTL_SECONDS,
  3600,
);

const useSsl = bool(process.env.STORAGE_USE_SSL, false);

// Per-kind upload caps. Video gets its own, larger allowance: a few seconds of
// phone video clears the general cap on its own.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

// Cap on the combined size of every attachment in a single message. Without it
// a message is unbounded even though each upload is not: ten max-size videos
// would sail through as one 200MB send.
const MAX_MESSAGE_BYTES = 50 * 1024 * 1024;

warnInProduction(
  !useSsl,
  "STORAGE_USE_SSL is false — object-storage traffic, including the request signature, is unencrypted.",
);

export const uploadsConfig = {
  // The MinIO dev credentials are rejected outright in production: defaulting
  // them there boots a healthy-looking server that 403s on the first upload —
  // or, worse, succeeds against a store still running the published default.
  endpoint: requiredInProduction(
    process.env.STORAGE_ENDPOINT,
    "STORAGE_ENDPOINT",
    { insecureDevDefault: "localhost" },
  ),
  port: positiveNum(process.env.STORAGE_PORT, 9000),
  useSsl,
  region: str(process.env.STORAGE_REGION, "us-east-1"),
  accessKeyId: requiredInProduction(
    process.env.STORAGE_ACCESS_KEY,
    "STORAGE_ACCESS_KEY",
    { insecureDevDefault: "minioadmin" },
  ),
  secretAccessKey: requiredInProduction(
    process.env.STORAGE_SECRET_KEY,
    "STORAGE_SECRET_KEY",
    { insecureDevDefault: "minioadmin" },
  ),
  bucket: requiredInProduction(process.env.STORAGE_BUCKET, "STORAGE_BUCKET", {
    devDefault: "bakbak",
  }),
  // Optional in every environment: empty means attachments are served through
  // signed URLs instead of a public CDN origin.
  publicUrl: process.env.STORAGE_PUBLIC_URL ?? "",
  // Signed-URL lifetime for attachments (uploads + message attachments).
  signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
  // Signed-URL lifetime for avatars.
  avatarUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
  // Hard cap for message attachments other than video.
  maxFileSize: MAX_ATTACHMENT_BYTES,
  // Hard cap for video attachments.
  maxVideoSize: MAX_VIDEO_BYTES,
  // The largest any single upload can be. Multer and the multipart body limit
  // are sized against this; the per-kind check then narrows it once the file
  // is buffered and its kind is known.
  maxUploadSize: Math.max(MAX_ATTACHMENT_BYTES, MAX_VIDEO_BYTES),
  // Hard cap for avatars (signup + profile).
  maxAvatarSize: 1024 * 1024,
  // Total attachment bytes one user may store. Past this, uploads are refused
  // and everything else — sending messages included — carries on working.
  userQuotaBytes: 100 * 1024 * 1024,
  // Combined size of all attachments a single message may carry.
  maxMessageBytes: MAX_MESSAGE_BYTES,
  allowedAvatarMime: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/bmp",
  ],
};
