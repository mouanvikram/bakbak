import type Redis from "ioredis";
import { getRedisClient, isRedisReady } from "./client";
import { redisConfig } from "./config";
import logger from "@/lib/logger";

const CACHE_KEY_PREFIX = "cache:";
const CLEAR_RETRY_MS = 1000;

function prefixed(key: string): string {
  return `${CACHE_KEY_PREFIX}${key}`;
}

/**
 * The seam this module reads its connection through: production binds to the
 * shared client; tests bind to a duplicate, so exercising an outage never
 * disconnects the connection the rest of the process is using.
 */
export type CacheStore = {
  getRedisClient: () => Redis | null;
  isRedisReady: () => boolean;
};

// ===== Reconnect safety =====================================================
// While Redis is unreachable every helper below is skipped — invalidations
// included — so a write made during an outage leaves its old entry behind.
// To never serve it, the whole `cache:` namespace is cleared when the
// connection comes back, and the cache stays unused until that finishes.

type CacheState = "down" | "clearing" | "usable";

/** SCAN + DEL every key matching `pattern`; resolves to how many went. A plain
 *  cursor loop rather than `scanStream()` + `for await`, which can stall under
 *  Bun when a scan page comes back empty. */
async function deleteMatching(client: Redis, pattern: string): Promise<number> {
  let removed = 0;
  let cursor = "0";
  do {
    const [next, keys] = await client.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = next;
    if (keys.length) removed += await client.del(...keys);
  } while (cursor !== "0");
  return removed;
}

/**
 * Builds a cache bound to one store. Each instance owns its connection state,
 * so a test instance can go down and come back without touching production's.
 */
export function makeCache(store: CacheStore) {
  let state: CacheState = "down";
  // Set once stale entries may exist: the connection dropped while the cache
  // was in use, or an invalidation couldn't reach Redis.
  let needsClear = false;
  let watched: Redis | null = null;
  // In-process stampede guard: concurrent misses for the same key share one
  // loader call instead of each hitting the source simultaneously.
  const inflight = new Map<string, Promise<unknown>>();

  function watchConnection(): void {
    // The store may hand back nothing: the shared client is cleared by
    // `closeRedisClient()` on shutdown, so a read arriving during or after
    // teardown finds it gone. This module fails open by design — throwing out
    // of a read path would turn a degraded cache into a 500.
    const client = store.getRedisClient();
    if (!client) {
      // Same rule as losing the connection: anything cached before this may
      // now be stale, so the next reconnect has to clear.
      if (state === "usable") needsClear = true;
      watched = null;
      state = "down";
      return;
    }

    if (watched === client) return;
    watched = client;
    state = "down";

    client.on("ready", () => void onReady(client));
    client.on("close", () => {
      if (state === "usable") needsClear = true;
      state = "down";
    });
    if (client.status === "ready") void onReady(client);
  }

  async function onReady(client: Redis): Promise<void> {
    if (client !== watched || state !== "down") return;
    if (!needsClear) {
      state = "usable";
      return;
    }

    state = "clearing";
    try {
      const removed = await deleteMatching(client, `${CACHE_KEY_PREFIX}*`);
      needsClear = false;
      logger.info({ removed }, "[Cache] cleared after reconnect");
      if (state === "clearing") {
        state = client.status === "ready" ? "usable" : "down";
      }
    } catch (error) {
      logger.warn(
        { err: error },
        "[Cache] clear after reconnect failed; retrying",
      );
      if (state === "clearing") {
        state = "down";
        setTimeout(() => {
          if (client.status === "ready") void onReady(client);
        }, CLEAR_RETRY_MS);
      }
    }
  }

  /** True only while Redis is connected and nothing stale can be served. */
  function isCacheUsable(): boolean {
    watchConnection();
    return state === "usable" && store.isRedisReady();
  }

  /** An invalidation didn't happen; make sure the next reconnect clears. */
  function markStale(): void {
    // A clear already in progress covers it: SCAN returns every key that
    // exists for the whole scan, and nothing is written while clearing.
    if (state !== "clearing") needsClear = true;
  }

  /** Read a JSON value; a miss, a parse error, or an unavailable cache all
   *  resolve to `null` (the source-of-truth caller path). */
  async function getJson<T>(key: string): Promise<T | null> {
    if (!isCacheUsable()) return null;
    try {
      const raw = await store.getRedisClient()?.get(prefixed(key));
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      logger.warn({ err: error, key }, "Cache read failed; treating as miss");
      return null;
    }
  }

  /** Store a JSON value with an absolute TTL. Errors are swallowed (never
   *  throw into a request path) and logged. */
  async function setJson(
    key: string,
    value: unknown,
    ttlSec: number = redisConfig.cache.defaultTtlSec,
  ): Promise<void> {
    if (!isCacheUsable()) return;
    try {
      const ttl = Math.max(1, Math.floor(ttlSec));
      await store
        .getRedisClient()
        ?.set(prefixed(key), JSON.stringify(value), "EX", ttl);
    } catch (error) {
      logger.warn({ err: error, key }, "Cache write skipped");
    }
  }

  /** Delete one key. Best-effort — if it can't reach Redis, the next reconnect
   *  clears the namespace instead. */
  async function invalidate(key: string): Promise<void> {
    if (!isCacheUsable()) return markStale();
    try {
      await store.getRedisClient()?.del(prefixed(key));
    } catch (error) {
      markStale();
      logger.warn({ err: error, key }, "Cache invalidation skipped");
    }
  }

  /** Delete every key matching `pattern` (globs allowed) via a non-blocking
   *  SCAN, so invalidation-by-tag never freezes Redis on a large keyspace. */
  async function invalidatePattern(pattern: string): Promise<void> {
    const full = `${CACHE_KEY_PREFIX}${pattern}`;
    if (!isCacheUsable()) return markStale();
    const client = store.getRedisClient();
    if (!client) return markStale();
    try {
      await deleteMatching(client, full);
    } catch (error) {
      markStale();
      logger.warn(
        { err: error, pattern: full },
        "Cache pattern invalidation skipped",
      );
    }
  }

  function cacheAside<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!isCacheUsable()) return loader();

    return getJson<T>(key).then((cached) => {
      if (cached !== null) return cached;

      let pending = inflight.get(key) as Promise<T> | undefined;
      if (!pending) {
        pending = loader()
          .then((value) => setJson(key, value, ttlSec).then(() => value))
          .finally(() => {
            inflight.delete(key);
          });
        inflight.set(key, pending);
      }
      return pending;
    });
  }

  return {
    isCacheUsable,
    getJson,
    setJson,
    invalidate,
    invalidatePattern,
    cacheAside,
  };
}

// The production cache, bound to the shared client.
const cache = makeCache({ getRedisClient, isRedisReady });

export const isCacheUsable = cache.isCacheUsable;
export const getJson = cache.getJson;
export const setJson = cache.setJson;
export const invalidate = cache.invalidate;
export const invalidatePattern = cache.invalidatePattern;
export const cacheAside = cache.cacheAside;
