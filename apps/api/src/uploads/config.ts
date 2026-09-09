// Storage backend connection, signed-URL TTLs, and upload size / type guards (enforced by the multer middlewares).
import { bool, positiveNum, str } from "@/config/parse";
const SIGNED_URL_TTL_SECONDS = positiveNum(
  process.env.SIGNED_URL_TTL_SECONDS,
  3600,
);

export const uploadsConfig = {
  endpoint: str(process.env.STORAGE_ENDPOINT, "localhost"),
  port: positiveNum(process.env.STORAGE_PORT, 9000),
  useSsl: bool(process.env.STORAGE_USE_SSL, false),
  region: str(process.env.STORAGE_REGION, "us-east-1"),
  accessKeyId: str(process.env.STORAGE_ACCESS_KEY, "minioadmin"),
  secretAccessKey: str(process.env.STORAGE_SECRET_KEY, "minioadmin"),
  bucket: str(process.env.STORAGE_BUCKET, "bakbak"),
  publicUrl: process.env.STORAGE_PUBLIC_URL ?? "",
  // Signed-URL lifetime for attachments (uploads + message attachments).
  signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
  // Signed-URL lifetime for avatars.
  avatarUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
  // Hard cap for message attachments.
  maxFileSize: 25 * 1024 * 1024,
  // Hard cap for avatars (signup + profile).
  maxAvatarSize: 4 * 1024 * 1024,
  allowedAvatarMime: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/bmp",
  ],
};
