import { getRedisClient, isRedisReady } from "./client";
import { redisConfig } from "./config";
import logger from "@/lib/logger";



const CACHE_KEY_PREFIX = "cache:";

function prefixed(key: string): string {
	return `${CACHE_KEY_PREFIX}${key}`;
}

/** Read a JSON value; a miss, a parse error, or an unavailable Redis all
 *  resolve to `null` (the source-of-truth caller path). */
export async function getJson<T>(key: string): Promise<T | null> {
	if (!isRedisReady()) return null;
	try {
		const raw = await getRedisClient().get(prefixed(key));
		return raw == null ? null : (JSON.parse(raw) as T);
	} catch (error) {
		logger.warn({ err: error, key }, "Cache read failed; treating as miss");
		return null;
	}
}

/** Store a JSON value with an absolute TTL. Errors are swallowed (never throw
 *  into a request path) and logged. */
export async function setJson(
	key: string,
	value: unknown,
	ttlSec: number = redisConfig.cache.defaultTtlSec,
): Promise<void> {
	if (!isRedisReady()) return;
	try {
		const ttl = Math.max(1, Math.floor(ttlSec));
		await getRedisClient().set(prefixed(key), JSON.stringify(value), "EX", ttl);
	} catch (error) {
		logger.warn({ err: error, key }, "Cache write skipped");
	}
}

/** Delete one key. Best-effort — a stale entry here only costs a miss later. */
export async function invalidate(key: string): Promise<void> {
	if (!isRedisReady()) return;
	try {
		await getRedisClient().del(prefixed(key));
	} catch (error) {
		logger.warn({ err: error, key }, "Cache invalidation skipped");
	}
}

/** Delete every key matching `pattern` (globs allowed) via a non-blocking
 *  SCAN, so invalidation-by-tag never freezes Redis on a large keyspace. */
export async function invalidatePattern(pattern: string): Promise<void> {
	if (!isRedisReady()) return;
	const full = `${CACHE_KEY_PREFIX}${pattern}`;
	try {
		const client = getRedisClient();
		const stream = client.scanStream({ match: full, count: 100 });
		for await (const keys of stream) {
			if (keys.length) await client.del(...keys);
		}
	} catch (error) {
		logger.warn({ err: error, pattern: full }, "Cache pattern invalidation skipped");
	}
}

// In-process stampede guard: concurrent misses for the same key share one
// loader call instead of each hitting the source simultaneously.
const inflight = new Map<string, Promise<unknown>>();


export function cacheAside<T>(
	key: string,
	ttlSec: number,
	loader: () => Promise<T>,
): Promise<T> {
	if (!isRedisReady()) return loader();

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