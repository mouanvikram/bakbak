import type { StorageProvider } from "./storage.provider";
import { uploadsConfig } from "./config";

/**
 * Resolves a stored avatar (either a legacy URL or a storage key) into a
 * fetchable URL. New uploads persist a durable storage key; legacy rows that
 * already store an http(s) URL are passed through unchanged.
 *
 * When a public base URL (CDN) is configured, this returns a stable public
 * URL; otherwise it returns a signed URL with the given TTL.
 */
export async function resolveAvatarUrl(
  avatar: string | null | undefined,
  storageProvider: StorageProvider,
): Promise<string | null> {
  if (!avatar) return null;
  if (/^https?:\/\//.test(avatar)) return avatar;
  return storageProvider.getSignedUrl(
    avatar,
    uploadsConfig.avatarUrlTtlSeconds,
  );
}
