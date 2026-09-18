import { Prisma, type MessageType, prisma } from "@bakbak/db";

const messageUserSelect = {
  id: true,
  username: true,
  profile: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      avatar: true,
    },
  },
} satisfies Prisma.UserSelect;

/** Everything a serialized message carries: its sender, attachments, the
 *  quoted original, and reactions in the order they were added. */
const messageInclude = {
  sender: {
    select: messageUserSelect,
  },
  attachments: true,

  replyTo: {
    include: {
      sender: {
        select: messageUserSelect,
      },
      attachments: true,
    },
  },
  reactions: {
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.MessageInclude;

const participantInclude = {
  user: {
    select: messageUserSelect,
  },
} satisfies Prisma.ChatParticipantInclude;

/** One page of a cursor-paginated read, as `cursorPaginationArgs` builds it. */
export interface MessagePage {
  cursor?: { id: string };
  skip?: number;
  take?: number;
}

/** The fields a message row is created from. */
export interface NewMessage {
  type: MessageType;
  text: string | undefined;
  clientId: string;
  chatId: string;
  senderId: string;
  replyToId?: string;
}

export class MessageRepository {
  /**
   * Creates the message and bumps the chat's `lastMessageAt` in one
   * transaction, so a send is never half-persisted.
   */
  async createMessage(message: NewMessage) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          type: message.type,
          text: message.text,
          clientId: message.clientId,
          chat: { connect: { id: message.chatId } },
          sender: { connect: { id: message.senderId } },
          ...(message.replyToId
            ? { replyTo: { connect: { id: message.replyToId } } }
            : {}),
        },
        include: messageInclude,
      });

      await tx.chat.update({
        where: { id: created.chatId },
        data: { lastMessageAt: created.createdAt },
      });

      return created;
    });
  }

  /** One message, with everything needed to serialize it. */
  async findByIdWithDetail(messageId: string) {
    return await prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });
  }

  /** The sender's earlier message carrying this client id — the idempotency
   *  key. Ids are unique per sender, not per chat, so the caller checks the
   *  chat matches. */
  async findByClientId(senderId: string, clientId: string) {
    return await prisma.message.findFirst({
      where: { senderId, clientId },
      include: messageInclude,
    });
  }

  /** A page of a chat's messages, newest first. */
  async findChatMessages(chatId: string, page: MessagePage) {
    return await prisma.message.findMany({
      where: { chatId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...page,
      include: messageInclude,
    });
  }

  /** A page of a chat's messages matching `query`, newest first. */
  async searchChatMessages(chatId: string, query: string, page: MessagePage) {
    return await prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        text: { contains: query, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      ...page,
      include: messageInclude,
    });
  }

  /** Id of the most recent visible message in a chat, or null if it's empty. */
  async findLatestMessageId(chatId: string) {
    const message = await prisma.message.findFirst({
      where: { chatId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return message?.id ?? null;
  }

  /** Whether this message is in that chat and still visible. */
  async messageExistsInChat(messageId: string, chatId: string) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, chatId, deletedAt: null },
      select: { id: true },
    });
    return message !== null;
  }

  /** When a message was sent — the boundary unread counting works from. */
  async findMessageTimestamp(messageId: string, chatId: string) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, chatId },
      select: { createdAt: true },
    });
    return message?.createdAt ?? null;
  }

  /** Visible messages from other people, newer than `since` (all of them when
   *  the reader has never marked anything read). */
  async countUnread(chatId: string, userId: string, since: Date | null) {
    return await prisma.message.count({
      where: {
        chatId,
        deletedAt: null,
        senderId: { not: userId },
        createdAt: since ? { gt: since } : undefined,
      },
    });
  }

  async updateText(messageId: string, text: string) {
    return await prisma.message.update({
      where: { id: messageId },
      // Type is deliberately untouched: editing a caption must not turn a
      // media message into TEXT.
      data: { text },
      include: messageInclude,
    });
  }

  /** Soft delete: the row stays, its text goes. */
  async markDeleted(messageId: string) {
    return await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), text: null },
      include: messageInclude,
    });
  }

  async findActiveParticipant(chatId: string, userId: string) {
    return await prisma.chatParticipant.findFirst({
      where: { chatId, userId, leftAt: null },
    });
  }

  /** Moves a member's read pointer. Null clears it, for a chat with nothing
   *  left to acknowledge. */
  async setLastReadMessage(
    chatId: string,
    userId: string,
    messageId: string | null,
  ) {
    return await prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadMessageId: messageId },
      include: participantInclude,
    });
  }

  async findReaction(messageId: string, userId: string, emoji: string) {
    return await prisma.messageReaction.findFirst({
      where: { messageId, userId, emoji },
    });
  }

  async createReaction(messageId: string, userId: string, emoji: string) {
    return await prisma.messageReaction.create({
      data: { messageId, userId, emoji },
    });
  }

  async deleteReaction(id: string) {
    return await prisma.messageReaction.delete({ where: { id } });
  }
}
