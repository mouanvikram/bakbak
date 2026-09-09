import { uploadsConfig } from "./config";
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
    endpoint: uploadsConfig.endpoint,
    port: uploadsConfig.port,
    useSsl: uploadsConfig.useSsl,
    region: uploadsConfig.region,
    accessKeyId: uploadsConfig.accessKeyId,
    secretAccessKey: uploadsConfig.secretAccessKey,
    bucket: uploadsConfig.bucket,
    publicUrl: uploadsConfig.publicUrl,
  });
}

export const storageProvider: StorageProvider = createStorageProvider();
