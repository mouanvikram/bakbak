import type { Server } from "socket.io";
import type { MessageResponseType } from "@bakbak/contracts";

let ioRef: Server | null = null;

export function setIo(io: Server) {
  ioRef = io;
}

export function broadcastToChat(
  chatId: string,
  event: string,
  payload: unknown,
) {
  if (!ioRef) return;
  ioRef.to(`chat:${chatId}`).emit(event, payload);
}

/** Metadata change to a chat (name, photo, members). Payload is a
 * serialized chat (ChatResponseType shape). */
export function broadcastChatUpdated(chatId: string, chat: unknown) {
  broadcastToChat(chatId, "chat:updated", chat);
}

/** Live sockets, on any API server, that belong to one of `userIds`. */
async function socketsOfUsers(userIds: string[]) {
  if (!ioRef || userIds.length === 0) return [];
  const wanted = new Set(userIds);
  const sockets = await ioRef.fetchSockets();
  return sockets.filter((s) =>
    wanted.has((s.data as SocketIdentity).userId ?? ""),
  );
}

/**
 * Join these users' live sockets to a chat room, so new members — and both
 * sides of a new or re-opened direct chat — start receiving the chat's events
 * without waiting for a reconnect.
 */
export async function addUsersToChatRoom(userIds: string[], chatId: string) {
  for (const s of await socketsOfUsers(userIds)) {
    s.join(`chat:${chatId}`);
  }
}

/**
 * Remove these users' live sockets from a chat room — every tab, device and
 * server — once they've left or been removed, so they stop receiving its
 * messages now rather than at their next reconnect. Membership is decided
 * here on the server; clients can't leave rooms themselves.
 */
export async function removeUsersFromChatRoom(
  userIds: string[],
  chatId: string,
) {
  for (const s of await socketsOfUsers(userIds)) {
    s.leave(`chat:${chatId}`);
  }
}

interface SocketIdentity {
  userId?: string;
  sessionId?: string;
}

// Drop live sockets when their session is revoked, so logout / "end session"
// takes effect now instead of lingering until the access token expires.
// `keepSessionId` spares the caller's own session.
export async function disconnectSockets(opts: {
  userId: string;
  sessionIds?: string[];
  keepSessionId?: string | null;
}) {
  if (!ioRef) return;
  const targetSessions = opts.sessionIds ? new Set(opts.sessionIds) : null;
  const sockets = await ioRef.fetchSockets();
  for (const s of sockets) {
    const data = s.data as SocketIdentity;
    if (data.userId !== opts.userId) continue;
    if (
      targetSessions &&
      !(data.sessionId && targetSessions.has(data.sessionId))
    )
      continue;
    if (opts.keepSessionId && data.sessionId === opts.keepSessionId) continue;
    s.disconnect(true);
  }
}

export function broadcastMessage(chatId: string, message: MessageResponseType) {
  broadcastToChat(chatId, "message:new", message);
}

export function broadcastMessageEdited(
  chatId: string,
  message: MessageResponseType,
) {
  broadcastToChat(chatId, "message:edited", message);
}

export function broadcastMessageDeleted(
  chatId: string,
  message: MessageResponseType,
) {
  broadcastToChat(chatId, "message:deleted", message);
}

export function broadcastMessageReaction(
  chatId: string,
  message: MessageResponseType,
) {
  broadcastToChat(chatId, "message:reaction", message);
}

export function broadcastReadReceipt(
  chatId: string,
  userId: string,
  messageId: string,
) {
  broadcastToChat(chatId, "read:receipt", { chatId, userId, messageId });
}
