/**
 * Socket.IO room names, in one place — the same reason Redis keys go through
 * `presenceKeys`.
 *
 * The format is a cross-server contract: with the Redis adapter, one API
 * instance publishes to a room name that another instance resolves, so build
 * and parse must never drift apart. Keeping both here is what guarantees it.
 */

const CHAT_ROOM_PREFIX = "chat:";

export const rooms = {
  /** The room carrying one chat's live events. */
  chat: (chatId: string) => `${CHAT_ROOM_PREFIX}${chatId}`,

  /**
   * The chat ids among the rooms a socket currently holds. A socket is also in
   * a room named after its own id, which this skips.
   */
  chatIdsIn: (socketRooms: Iterable<string>): string[] =>
    [...socketRooms]
      .filter((room) => room.startsWith(CHAT_ROOM_PREFIX))
      .map((room) => room.slice(CHAT_ROOM_PREFIX.length)),
};
