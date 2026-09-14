import type Redis from "ioredis";
import logger from "@/lib/logger";
import { getRedisClient, isRedisReady } from "@/redis/client";
import { presenceConfig } from "./config";

export const presenceKeys = {
  userSockets: (userId: string) => `presence:user:${userId}`,
  online: "presence:online",
};

// The commands are registered on the shared client in client.ts (defineCommand).
type PresenceCommander = Redis & {
  presenceTouch: (
    userSocketsKey: string,
    onlineKey: string,
    socketId: string,
    ttlMs: number,
    userId: string,
  ) => Promise<number>;
  presenceRelease: (
    userSocketsKey: string,
    onlineKey: string,
    socketId: string,
    userId: string,
  ) => Promise<[number, number]>;
};

// Fail-open mirror: keeps today's single-instance behaviour when Redis is down
// or reconnecting, so a socket lifecycle never breaks on a Redis blip. Redis is
// authoritative whenever it is ready.
const localSockets = new Map<string, Set<string>>();

export interface PresenceState {
  first: boolean;
}

export interface PresenceReleaseResult {
  offline: boolean;
  at: Date;
}

// Registers this socket's badge for an online user. `first` is true only when
// it is the first live socket anywhere in the cluster — the online transition.
export async function touchSocket(
  userId: string,
  socketId: string,
): Promise<PresenceState> {
  let sockets = localSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    localSockets.set(userId, sockets);
  }
  const wasFirst = sockets.size === 0;
  sockets.add(socketId);

  const redis = readyClient();
  if (!redis) return { first: wasFirst };

  try {
    const first = await redis.presenceTouch(
      presenceKeys.userSockets(userId),
      presenceKeys.online,
      socketId,
      presenceConfig.socketTtlMs,
      userId,
    );
    return { first: first === 1 };
  } catch (err) {
    logger.warn({ err, userId }, "Presence touch failed; using local fallback");
    return { first: wasFirst };
  }
}

// Drops a dead socket. `offline` is true when the user has no live sockets
// anywhere in the cluster — the offline transition (also records lastSeen).
export async function releaseSocket(
  userId: string,
  socketId: string,
): Promise<PresenceReleaseResult> {
  const sockets = localSockets.get(userId);
  sockets?.delete(socketId);
  const localOffline = (sockets?.size ?? 0) === 0;
  if (sockets?.size === 0) localSockets.delete(userId);

  const redis = readyClient();
  if (!redis) return { offline: localOffline, at: new Date() };

  try {
    const [offlineFlag, nowMs] = await redis.presenceRelease(
      presenceKeys.userSockets(userId),
      presenceKeys.online,
      socketId,
      userId,
    );
    return { offline: offlineFlag === 1, at: new Date(nowMs) };
  } catch (err) {
    logger.warn(
      { err, userId },
      "Presence release failed; using local fallback",
    );
    return { offline: localOffline, at: new Date() };
  }
}

export async function onlineAmong(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const redis = readyClient();
  if (!redis) return new Set();

  try {
    const [[sec, micro], scores] = await Promise.all([
      redis.time(),
      redis.zmscore(presenceKeys.online, ...userIds),
    ]);

    const nowMs = Number(sec) * 1000 + Math.floor(Number(micro) / 1000);

    return new Set(
      userIds.filter((_, i) => {
        scores[i] !== null && Number(scores[i]) > nowMs;
      }),
    );
  } catch (err) {
    logger.warn({ err }, "Presence lookup failed; using local fallback");
  }
  return new Set(userIds.filter((id) => (localSockets.get(id)?.size ?? 0) > 0));
}
function readyClient(): PresenceCommander | null {
  const redis = getRedisClient() as PresenceCommander;
  return isRedisReady() ? redis : null;
}
