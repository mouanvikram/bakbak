// Storage backend connection, signed-URL TTLs, and upload size / type guards (enforced by the multer middlewares).
import { bool, positiveNum, str } from "@/config/parse";
import { requiredInProduction, warnInProduction } from "@/config/required";

const SIGNED_URL_TTL_SECONDS = positiveNum(
  process.env.SIGNED_URL_TTL_SECONDS,
  3600,
);

const useSsl = bool(process.env.STORAGE_USE_SSL, false);

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
