import "./setup";
import { afterAll, describe, expect, test } from "bun:test";
import { getRedisClient } from "@/redis/client";
import { makeCache } from "@/redis/cache";

// A duplicate of the shared connection, driven by a cache instance of its own.
// The outage these tests need is real — the reconnect clear is what's under
// test — but it happens on this connection only, so no other test file ever
// sees the shared client go down.
const client = getRedisClient().duplicate();

const { cacheAside, getJson, invalidate, isCacheUsable, setJson } = makeCache({
  getRedisClient: () => client,
  isRedisReady: () => client.status === "ready",
});

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
    // ioredis retries on its own; `connect()` throws if it got there first.
    if (client.status !== "ready" && client.status !== "connecting") {
      await client.connect().catch(() => {});
    }
    await waitFor(() => isCacheUsable());
  };

  afterAll(async () => {
    if (client.status !== "ready") await reconnect().catch(() => {});
    await invalidate(key);
    // This connection belongs to this file alone; don't leave it open.
    await client.quit().catch(() => client.disconnect());
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

describe("Cache without a connection", () => {
  // The store hands back nothing — what a read arriving after shutdown sees.
  const gone = makeCache({
    getRedisClient: () => null,
    isRedisReady: () => false,
  });

  test("reports itself unusable instead of throwing", () => {
    expect(gone.isCacheUsable()).toBe(false);
  });

  test("reads miss, writes and invalidations are no-ops, and loaders still run", async () => {
    expect(await gone.getJson("anything")).toBeNull();
    await gone.setJson("anything", { a: 1 }, 30);
    await gone.invalidate("anything");
    await gone.invalidatePattern("anything*");

    let loads = 0;
    const value = await gone.cacheAside("anything", 30, async () => {
      loads += 1;
      return "from source";
    });
    expect(value).toBe("from source");
    expect(loads).toBe(1);
  });
});
