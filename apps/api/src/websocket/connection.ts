import type { Server, Socket } from "socket.io";
import logger from "@/lib/logger";
import { chatRepository, userRepository } from "@/services/service.container";
import { type AuthenticatedSocket } from "./auth";
import { websocketConfig } from "./config";
import { rooms } from "./rooms";
import { presenceConfig } from "@/redis/presence/config";
import { touchSocket, releaseSocket, onlineAmong } from "@/redis/presence";

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

    // Auto-join every chat the user is an active participant of.
    const chatIds = await joinAllChats(s, userId);

    // Snapshots of who is already online, so a freshly opened chat shows the
    // right dots instead of waiting for the next connect/disconnect. One
    // membership query + one Redis lookup for every chat, rather than a
    // cluster-wide socket search per chat.
    const membersByChat = await participantsOf(chatIds, userId);
    const online = await onlineAmong([
      ...new Set([...membersByChat.values()].flat()),
    ]);

    for (const chatId of chatIds) {
      if (first) {
        s.to(rooms.chat(chatId)).emit("presence", { userId, online: true });
      }
      s.emit("presence:state", {
        chatId,
        online: (membersByChat.get(chatId) ?? []).filter((id) =>
          online.has(id),
        ),
      });
    }
  })();

  s.on("chat:join", async (chatId: unknown) => {
    if (typeof chatId !== "string") return;
    if (!(await isParticipant(chatId, userId))) return;
    void s.join(rooms.chat(chatId));

    s.to(rooms.chat(chatId)).emit("presence", { userId, online: true });
    const members = (await participantsOf([chatId], userId)).get(chatId) ?? [];
    const online = await onlineAmong(members);
    s.emit("presence:state", {
      chatId,
      online: members.filter((id) => online.has(id)),
    });
  });

  s.on("typing", async (data: unknown) => {
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

    const isMember = await isParticipant(d.chatId, userId);

    if (!isMember) return;
    s.to(rooms.chat(d.chatId)).emit("typing", {
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

    await chatRepository
      .setLastReadMessage(d.chatId, userId, d.messageId)
      .catch((err: unknown) =>
        logger.error({ err }, "Failed to persist read receipt"),
      );

    s.to(rooms.chat(d.chatId)).emit("read:receipt", {
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
    chatIdsAtDisconnect = rooms.chatIdsIn(s.rooms);
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
        void recordLastSeen(userId, at);
        for (const chatId of chatIdsAtDisconnect) {
          io.to(rooms.chat(chatId)).emit("presence", {
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

// "Last seen" bookkeeping on the profile row — written when a user's last
// socket goes away. Whether they're online *now* is Redis presence, never a
// column. Fire-and-forget: a failed write must never disrupt the socket
// lifecycle, and the next disconnect (or the presence sweep, which also calls
// this for users whose server died) corrects it.
export async function recordLastSeen(
  userId: string,
  lastSeenAt: Date = new Date(),
) {
  try {
    await userRepository.updateLastSeen(userId, lastSeenAt);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to persist last-seen time");
  }
}

// chatId → the other active members, in one query for however many chats.
async function participantsOf(
  chatIds: string[],
  exceptUserId: string,
): Promise<Map<string, string[]>> {
  const byChat = new Map<string, string[]>();
  if (chatIds.length === 0) return byChat;

  try {
    const rows = await chatRepository.findActiveParticipants(
      chatIds,
      exceptUserId,
    );
    for (const { chatId, userId } of rows) {
      const members = byChat.get(chatId);
      if (members) members.push(userId);
      else byChat.set(chatId, [userId]);
    }
  } catch (err) {
    logger.error({ err, exceptUserId }, "Failed to load chat participants");
  }
  return byChat;
}

async function joinAllChats(s: Socket, userId: string): Promise<string[]> {
  try {
    const rows = await chatRepository.findActiveChatIds(userId);

    const chatIds: string[] = [];
    for (const { chatId } of rows) {
      void s.join(rooms.chat(chatId));
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
    return await chatRepository.isActiveParticipant(chatId, userId);
  } catch (err) {
    // Fail closed, but say so: every inbound event that needs membership
    // silently stops working while this is throwing.
    logger.warn(
      { err, chatId, userId },
      "Membership check failed; treating as not a participant",
    );
    return false;
  }
}
