/**
 * StorageProvider abstracts the object-storage backend (MinIO, Amazon S3,
 * Cloudinary, R2, etc.). The database only stores the object "key" (a plain
 * string path), and every URL is generated on demand via signed links.
 *
 * To switch providers:
 *   1. Create a new implementation of this interface (e.g. storage-cloudinary.ts).
 *   2. Swap the factory in ./storage.ts.
 *   3. No database migration required — keys are provider-agnostic.
 */
export interface StorageProvider {
  /** Upload a buffer to the given key and return nothing on success. */
  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;

  /**
   * Produce a short-lived signed URL that grants temporary read access to
   * the object at `key`. Falls back to a public URL when available.
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /** Permanently remove the object at `key`. No-op if it does not exist. */
  delete(key: string): Promise<void>;

  /** Return true when an object exists at `key`. */
  exists(key: string): Promise<boolean>;

  /**
   * Lightweight, read-only connectivity probe (e.g. a bucket head request).
   * Used by the `/readyz` readiness probe; must be side-effect free.
   */
  ping(): Promise<boolean>;
}
