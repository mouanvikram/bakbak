import "./setup";
import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

// A short lease so the expiry path can be tested without waiting 90 s. Set
// before the presence module (and its config) is first imported.
const LEASE_MS = 300;
process.env.PRESENCE_SOCKET_TTL_MS = String(LEASE_MS);

const { getRedisClient, isRedisReady } = await import("@/redis/client");
const {
  onlineAmong,
  presenceKeys,
  releaseSocket,
  sweepExpiredPresence,
  touchSocket,
} = await import("@/redis/presence");

const client = getRedisClient();

async function redisReady(timeoutMs = 3000): Promise<boolean> {
  const started = Date.now();
  while (!isRedisReady()) {
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return true;
}

const REDIS_AVAILABLE = await redisReady();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!REDIS_AVAILABLE)("Presence (Redis)", () => {
  const users: string[] = [];
  const newUser = () => {
    const id = randomUUID();
    users.push(id);
    return id;
  };

  afterAll(async () => {
    if (!users.length) return;
    await client.del(...users.map((id) => presenceKeys.userSockets(id)));
    await client.zrem(presenceKeys.online, ...users);
  });

  test("onlineAmong - an empty list is nobody", async () => {
    expect(await onlineAmong([])).toEqual(new Set());
  });

  test("onlineAmong - includes a connected user and excludes everyone else", async () => {
    const alice = newUser();
    const bob = newUser();

    const { first } = await touchSocket(alice, "socket-a1");
    expect(first).toBe(true);

    expect(await onlineAmong([alice, bob])).toEqual(new Set([alice]));
  });

  test("a user stays online until their last socket disconnects", async () => {
    const alice = newUser();

    expect((await touchSocket(alice, "socket-a1")).first).toBe(true);
    expect((await touchSocket(alice, "socket-a2")).first).toBe(false);

    expect((await releaseSocket(alice, "socket-a1")).offline).toBe(false);
    expect(await onlineAmong([alice])).toEqual(new Set([alice]));

    expect((await releaseSocket(alice, "socket-a2")).offline).toBe(true);
    expect(await onlineAmong([alice])).toEqual(new Set());
  });

  test("onlineAmong - drops a user whose lease expired without a heartbeat", async () => {
    const alice = newUser();

    await touchSocket(alice, "socket-a1");
    expect(await onlineAmong([alice])).toEqual(new Set([alice]));

    await sleep(LEASE_MS + 150);
    expect(await onlineAmong([alice])).toEqual(new Set());
  });

  test("sweepExpiredPresence - returns a crashed user once, with their last heartbeat as last seen", async () => {
    const alice = newUser();

    const heartbeatAt = Date.now();
    await touchSocket(alice, "socket-a1");
    await sleep(LEASE_MS + 150);

    const swept = await sweepExpiredPresence();
    const entry = swept.find((e) => e.userId === alice);
    expect(entry).toBeDefined();
    // Last seen is the heartbeat, not the moment the sweep noticed.
    expect(Math.abs(entry!.lastSeenAt.getTime() - heartbeatAt)).toBeLessThan(100);

    // Removed from the index, and not handed out a second time.
    expect(await client.zscore(presenceKeys.online, alice)).toBeNull();
    const again = await sweepExpiredPresence();
    expect(again.some((e) => e.userId === alice)).toBe(false);
  });

  test("sweepExpiredPresence - leaves users with a live lease alone", async () => {
    const bob = newUser();
    await touchSocket(bob, "socket-b1");

    const swept = await sweepExpiredPresence();
    expect(swept.some((e) => e.userId === bob)).toBe(false);
    expect(await onlineAmong([bob])).toEqual(new Set([bob]));
  });
});
