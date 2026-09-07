// Uploads module config — storage backend connection, signed-URL TTLs, and
// upload size / type guards (enforced by the multer middlewares).
export const uploadsConfig = {
	endpoint: process.env.STORAGE_ENDPOINT ?? "localhost",
	port: Number(process.env.STORAGE_PORT) || 9000,
	useSsl: (process.env.STORAGE_USE_SSL ?? "false") === "true",
	region: process.env.STORAGE_REGION ?? "us-east-1",
	accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "minioadmin",
	secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "minioadmin",
	bucket: process.env.STORAGE_BUCKET ?? "bakbak",
	publicUrl: process.env.STORAGE_PUBLIC_URL ?? "",
	// Signed-URL lifetime for attachments (uploads + message attachments).
	signedUrlTtlSeconds: 3600,
	// Signed-URL lifetime for avatars.
	avatarUrlTtlSeconds: 3600,
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
