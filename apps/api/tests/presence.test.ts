import "./setup";
import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

// The expiry tests below seed a lapsed lease straight into Redis rather than
// shortening PRESENCE_SOCKET_TTL_MS and sleeping through it.
//
// That used to be the approach, and it was load-order dependent: presenceConfig
// is frozen the first time anything imports it, and websocket/connection.ts
// imports it too. Whenever that file loaded first the lease stayed 90 s, the
// sleep expired nothing, and exactly these two tests failed — on Linux CI but
// not on Windows, because the file order differs.

const { getRedisClient, isRedisReady } = await import("@/redis/client");
const {
  onlineAmong,
  presenceKeys,
  releaseSocket,
  sweepExpiredPresence,
  touchSocket,
} = await import("@/redis/presence");
const { presenceConfig } = await import("@/redis/presence/config");

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
/**
 * Leaves `userId` exactly as a crashed server does: in the online index with a
 * lease that ran out `agoMs` ago, and a socket whose own lease ran out with it.
 * Both keys hold expiry timestamps, so this needs no waiting and no particular
 * PRESENCE_SOCKET_TTL_MS. Returns the expiry it wrote.
 */
async function seedLapsedLease(
  userId: string,
  socketId: string,
  agoMs = 1_000,
): Promise<number> {
  const expiry = Date.now() - agoMs;
  await client.zadd(presenceKeys.online, expiry, userId);
  await client.zadd(presenceKeys.userSockets(userId), expiry, socketId);
  return expiry;
}

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

    // Drop the lease into the past instead of waiting it out.
    await seedLapsedLease(alice, "socket-a1");
    expect(await onlineAmong([alice])).toEqual(new Set());
  });

  test("sweepExpiredPresence - returns a crashed user once, with their last heartbeat as last seen", async () => {
    const alice = newUser();

    const expiry = await seedLapsedLease(alice, "socket-a1");
    // Last seen is the heartbeat, not the moment the sweep noticed — and the
    // heartbeat is the lease expiry minus the lease length, so this holds for
    // whatever PRESENCE_SOCKET_TTL_MS happens to be. Seeded values make it
    // exact rather than approximate.
    const expectedLastSeen = expiry - presenceConfig.socketTtlMs;

    const swept = await sweepExpiredPresence();
    const entry = swept.find((e) => e.userId === alice);
    expect(entry).toBeDefined();
    expect(entry!.lastSeenAt.getTime()).toBe(expectedLastSeen);

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
