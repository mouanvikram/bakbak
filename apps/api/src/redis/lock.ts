import { randomUUID } from "node:crypto";
import { getRedisClient, isRedisReady } from "./client";

// Cluster-atomic mutex for housekeeping jobs that must not run concurrently
// across API instances (two instances could otherwise pick the same rows and
// race each other). SET NX+PX is atomic, so only one instance ever wins.
// Ownership is asserted on release (compare-and-delete) so a renewal from a
// later run can never delete a lock it doesn't hold.

/**
 * Run `fn` only if the named lock is free, returning its result. Returns
 * `undefined` when another process holds the lock (or Redis is unavailable,
 * in which case nothing is run).
 */
export async function runWithLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) return undefined;

  const token = randomUUID();
  const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") return undefined;

  try {
    return await fn();
  } finally {
    // Only delete the key if we still own it — the TTL may have expired and
    // another instance taken the lock in the meantime.
    const release = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    await redis.eval(release, 1, key, token).catch(() => {});
  }
}

// Companions for callers that want to hold the lock across several awaited
// operations without an explicit release step.

export type LockHandle = {
  /** Run a callback under the lock. Returns its result, or undefined if the
   * lock is not (or no longer) held. */
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  /** Release the lock if still owned. */
  release: () => Promise<void>;
};

/**
 * Acquire the named lock and return a handle for running guarded work. If the
 * lock is already held (or Redis is unavailable), returns null and nothing is
 * run. Every acquired lock must be released, or it lives until the TTL.
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
): Promise<LockHandle | null> {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) return null;

  const token = randomUUID();
  const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") return null;

  let released = false;
  const releaseOnce = async () => {
    if (released) return;
    released = true;
    const release = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    await redis.eval(release, 1, key, token).catch(() => {});
  };

  return {
    run: async <T>(fn: () => Promise<T>) => {
      if (released) return undefined;
      try {
        return await fn();
      } finally {
        await releaseOnce();
      }
    },
    release: releaseOnce,
  };
}