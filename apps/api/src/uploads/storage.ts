import { env } from "@/config";
import type { StorageProvider } from "./storage.provider";
import { S3StorageProvider } from "./storage-s3";

/**
 * Factory that returns the configured storage provider.
 *
 * To switch backends (e.g. MinIO -> Cloudinary) implement StorageProvider in a
 * new file and return it here — everything downstream consumes the interface.
 */
function createStorageProvider(): StorageProvider {
	return new S3StorageProvider({
		endpoint: env.STORAGE_ENDPOINT,
		port: env.STORAGE_PORT,
		useSsl: env.STORAGE_USE_SSL,
		region: env.STORAGE_REGION,
		accessKeyId: env.STORAGE_ACCESS_KEY,
		secretAccessKey: env.STORAGE_SECRET_KEY,
		bucket: env.STORAGE_BUCKET,
		publicUrl: env.STORAGE_PUBLIC_URL,
	});
}

export const storageProvider: StorageProvider = createStorageProvider();
