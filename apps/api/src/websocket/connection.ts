import type { Server, Socket } from "socket.io";
import { prisma } from "@bakbak/db";
import logger from "@/lib/logger";
import { type AuthenticatedSocket } from "./auth";
import { websocketConfig } from "./config";
import { presenceConfig } from "@/redis/presence/config";
import { touchSocket, releaseSocket } from "@/redis/presence";

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// socketId → heartbeat timer refreshing the Redis presence badge
const heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();

export function registerConnection(io: Server, socket: AuthenticatedSocket) {
  const s = socket;
  const { userId, username } = s.data;

  logger.info({ socketId: s.id, userId, username }, "Socket connected");

  const heartbeatTimer = setInterval(() => {
    void touchSocket(userId, s.id);
  }, presenceConfig.heartbeatMs);

  heartbeatTimers.set(s.id, heartbeatTimer);

  void (async () => {
    // Cluster-wide: `first` only when this is the user's first live socket
    // anywhere, so multi-instance connects don't thrash the presence flags.
    const { first } = await touchSocket(userId, s.id);
    if (first) {
      void markPresence(userId, true);
    }

    // Auto-join every chat the user is an active participant of.
    const chatIds = await joinAllChats(s, userId);
    for (const chatId of chatIds) {
      if (first) {
        s.to(`chat:${chatId}`).emit("presence", { userId, online: true });
      }
      // Hand this socket a snapshot of who is already online in the room,
      // so a freshly opened chat shows the correct online/offline state
      // instead of waiting for the next connect/disconnect transition.
      s.emit("presence:state", {
        chatId,
        online: await onlineUserIdsInChat(io, chatId, userId),
      });
    }
  })();

  s.on("chat:join", async (chatId: unknown) => {
    if (typeof chatId !== "string") return;
    if (!(await isParticipant(chatId, userId))) return;
    void s.join(`chat:${chatId}`);

    s.to(`chat:${chatId}`).emit("presence", { userId, online: true });
    s.emit("presence:state", {
      chatId,
      online: await onlineUserIdsInChat(io, chatId, userId),
    });
  });

  s.on("typing", (data: unknown) => {
    const d = data as { chatId?: string; isTyping?: boolean } | undefined;
    if (!d?.chatId) return;

    const key = `${userId}:${d.chatId}`;
    const isTyping = d.isTyping ?? false;
    if (isTyping) {
      if (typingTimers.has(key)) return;
      typingTimers.set(
        key,
        setTimeout(
          () => typingTimers.delete(key),
          websocketConfig.typingThrottleMs,
        ),
      );
    } else {
      // Release the throttle so the next "started typing" is delivered.
      const t = typingTimers.get(key);
      if (t) {
        clearTimeout(t);
        typingTimers.delete(key);
      }
    }

    s.to(`chat:${d.chatId}`).emit("typing", {
      chatId: d.chatId,
      userId,
      username,
      isTyping,
    });
  });

  s.on("read:receipt", async (data: unknown) => {
    const d = data as { chatId?: string; messageId?: string } | undefined;
    if (!d?.chatId || !d?.messageId) return;
    if (!(await isParticipant(d.chatId, userId))) return;

    await prisma.chatParticipant
      .updateMany({
        where: { chatId: d.chatId, userId, leftAt: null },
        data: { lastReadMessageId: d.messageId },
      })
      .catch((err: unknown) =>
        logger.error({ err }, "Failed to persist read receipt"),
      );

    s.to(`chat:${d.chatId}`).emit("read:receipt", {
      chatId: d.chatId,
      userId,
      messageId: d.messageId,
    });
  });

  // Socket.IO has already emptied `s.rooms` by the time "disconnect" fires, so
  // capture the chats this socket is really in — including joins and leaves
  // made from other servers — while they're still there.
  let chatIdsAtDisconnect: string[] = [];
  s.on("disconnecting", () => {
    chatIdsAtDisconnect = [...s.rooms]
      .filter((room) => room.startsWith("chat:"))
      .map((room) => room.slice("chat:".length));
  });

  s.on("disconnect", (reason) => {
    logger.info({ socketId: s.id, userId, reason }, "Socket disconnected");

    const heartbeatTimer = heartbeatTimers.get(s.id);
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimers.delete(s.id);
    }

    // Cluster-wide: `offline` only when the user has no live socket anywhere.
    // `at` is Redis's clock at release — the same instant goes to the DB and
    // to the broadcast, so every client and the profile row agree.
    void releaseSocket(userId, s.id).then(({ offline, at }) => {
      if (offline) {
        void markPresence(userId, false, at);
        for (const chatId of chatIdsAtDisconnect) {
          io.to(`chat:${chatId}`).emit("presence", {
            userId,
            online: false,
            lastSeenAt: at.toISOString(),
          });
        }
      }
    });

    // Clear lingering typing timers for this socket's user.
    for (const tKey of [...typingTimers.keys()]) {
      if (tKey.startsWith(`${userId}:`)) {
        clearTimeout(typingTimers.get(tKey));
        typingTimers.delete(tKey);
      }
    }
  });
}

// Coarse online/last-seen bookkeeping on the profile row. Fire-and-forget:
// a failed write must never disrupt the socket lifecycle, and a stale flag
// self-corrects on the next connect/disconnect.
// Also used by the presence sweep job for users whose server never
// disconnected them cleanly.
export async function markPresence(
  userId: string,
  online: boolean,
  lastSeenAt: Date = new Date(),
) {
  try {
    await prisma.userProfile.update({
      where: { userId },
      data: online ? { isOnline: true } : { isOnline: false, lastSeenAt },
    });
  } catch (err) {
    logger.warn({ err, userId, online }, "Failed to persist presence flag");
  }
}

// Distinct userIds currently connected to a chat room, derived from the live
// socket set rather than a hand-maintained map so it can't drift out of sync.
async function onlineUserIdsInChat(
  io: Server,
  chatId: string,
  exceptUserId?: string,
): Promise<string[]> {
  const sockets = await io.in(`chat:${chatId}`).fetchSockets();
  const ids = new Set<string>();
  for (const sk of sockets) {
    const uid = (sk.data as { userId?: string }).userId;
    if (uid && uid !== exceptUserId) ids.add(uid);
  }
  return [...ids];
}

async function joinAllChats(s: Socket, userId: string): Promise<string[]> {
  try {
    const rows = await prisma.chatParticipant.findMany({
      where: { userId, leftAt: null },
      select: { chatId: true },
    });

    const chatIds: string[] = [];
    for (const { chatId } of rows) {
      void s.join(`chat:${chatId}`);
      chatIds.push(chatId);
    }
    return chatIds;
  } catch (err) {
    logger.error({ err, userId }, "Failed to auto-join chat rooms");
    return [];
  }
}

async function isParticipant(chatId: string, userId: string): Promise<boolean> {
  try {
    const p = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { leftAt: true },
    });
    return p !== null && p.leftAt === null;
  } catch {
    return false;
  }
}
