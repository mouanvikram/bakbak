import "./setup";
import { describe, test, expect } from "bun:test";
import { getRedisClient, isRedisReady } from "@/redis/client";
import { acquireLock, runWithLock } from "@/redis/lock";

const client = getRedisClient();
void client;

const REDIS_AVAILABLE = await Promise.race([
  (async () => {
    while (!isRedisReady()) await new Promise((r) => setTimeout(r, 20));
    return true;
  })(),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)),
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!REDIS_AVAILABLE)("Distributed lock", () => {
  const KEY = `test:lock:${Date.now()}`;
  const TTL_MS = 5000;

  test("a second acquirer gets null until the holder releases", async () => {
    const first = await acquireLock(KEY, TTL_MS);
    expect(first).not.toBeNull();

    const second = await acquireLock(KEY, TTL_MS);
    expect(second).toBeNull();

    await first!.release();

    const third = await acquireLock(KEY, TTL_MS);
    expect(third).not.toBeNull();
    await third!.release();
  });

  test("runWithLock returns undefined while the lock is held, then runs after release", async () => {
    const handle = await acquireLock(KEY, TTL_MS);
    expect(handle).not.toBeNull();

    const during = await runWithLock(KEY, TTL_MS, async () => "ran");
    expect(during).toBeUndefined();

    await handle!.release();

    const after = await runWithLock(KEY, TTL_MS, async () => "ran");
    expect(after).toBe("ran");
  });

  test("a stale lock expires and can be taken over", async () => {
    await acquireLock(KEY, 50); // never released — it must die by TTL
    await sleep(120);

    const takeover = await acquireLock(KEY, TTL_MS);
    expect(takeover).not.toBeNull();
    await takeover!.release();
  });

  test("release is a no-op once ownership is lost", async () => {
    const first = await acquireLock(KEY, 50);
    expect(first).not.toBeNull();
    await sleep(120); // first's lease expires

    const takeover = await acquireLock(KEY, TTL_MS);
    expect(takeover).not.toBeNull();
    // The expired holder releasing again must NOT delete the new owner's lock.
    await first!.release();

    const during = await runWithLock(KEY, TTL_MS, async () => "ran");
    expect(during).toBeUndefined();

    await takeover!.release();
    const after = await runWithLock(KEY, TTL_MS, async () => "ran");
    expect(after).toBe("ran");
  });
});