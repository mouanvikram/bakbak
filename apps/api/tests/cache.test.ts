import "./setup";
import { afterAll, describe, expect, test } from "bun:test";
import { getRedisClient } from "@/redis/client";
import {
  cacheAside,
  getJson,
  invalidate,
  isCacheUsable,
  setJson,
} from "@/redis/cache";

const client = getRedisClient();

async function waitFor(check: () => boolean, timeoutMs = 5000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for the cache state to change");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const REDIS_AVAILABLE = await waitFor(() => isCacheUsable(), 3000).then(
  () => true,
  () => false,
);

describe.skipIf(!REDIS_AVAILABLE)("Cache reconnect safety", () => {
  const key = `test:reconnect:${Date.now()}`;

  const reconnect = async () => {
    await client.connect();
    await waitFor(() => isCacheUsable());
  };

  afterAll(async () => {
    if (client.status !== "ready") await reconnect().catch(() => {});
    await invalidate(key);
  });

  test("an invalidation missed during an outage doesn't serve the old entry after reconnect", async () => {
    await setJson(key, { name: "before" }, 300);
    expect(await getJson<{ name: string }>(key)).toEqual({ name: "before" });

    client.disconnect();
    await waitFor(() => !isCacheUsable());

    // The write's invalidation can't reach Redis…
    await invalidate(key);

    // …and reads go straight to the source while the cache is down.
    let loads = 0;
    const value = await cacheAside(key, 300, async () => {
      loads += 1;
      return { name: "fresh" };
    });
    expect(value).toEqual({ name: "fresh" });
    expect(loads).toBe(1);

    await reconnect();

    // The stale "before" entry was cleared on reconnect.
    expect(await getJson(key)).toBeNull();
  });

  test("the cache stays unused until the post-reconnect clear has finished", async () => {
    await setJson(key, { name: "cached" }, 300);

    client.disconnect();
    await waitFor(() => !isCacheUsable());

    // Assigned inside the listener, which control-flow narrowing can't see.
    let usableWhenReady = null as boolean | null;
    client.once("ready", () => {
      usableWhenReady = isCacheUsable();
    });

    await reconnect();

    expect(usableWhenReady).toBe(false);
    expect(await getJson(key)).toBeNull();
  });
});
