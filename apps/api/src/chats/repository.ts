import { ChatType, ParticipantRole, Prisma, prisma } from "@bakbak/db";

const chatUserSelect = {
  id: true,
  username: true,
  profile: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      avatar: true,
      lastSeenAt: true,
    },
  },
} satisfies Prisma.UserSelect;

/** A chat with its active roster and the most recent `messageTake` messages —
 *  the shape every chat response is serialized from. */
const getChatInclude = (messageTake = 1) =>
  ({
    createdBy: {
      select: chatUserSelect,
    },
    participants: {
      where: {
        leftAt: null,
      },
      select: {
        id: true,
        chatId: true,
        userId: true,
        role: true,
        joinedAt: true,
        lastReadMessageId: true,
        mutedUntil: true,
        isPinned: true,
        isArchived: true,
        user: {
          select: chatUserSelect,
        },
      },
    },
    messages: {
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: messageTake,
      select: {
        id: true,
        type: true,
        text: true,
        senderId: true,
        chatId: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  }) satisfies Prisma.ChatInclude;

const participantInclude = {
  user: {
    select: chatUserSelect,
  },
} satisfies Prisma.ChatParticipantInclude;

/** One page of a cursor-paginated read. */
export interface ChatPage {
  cursor?: { id: string };
  skip?: number;
  take?: number;
}

export interface NewGroupChat {
  name: string;
  description: string | null;
  avatar?: string | null;
  createdById: string;
  participantIds: string[];
}

/** The group fields an admin can edit; absent keys are left alone. */
export interface GroupChatEdit {
  name?: string;
  avatar?: string | null;
  description?: string | null;
}

/** A member's own view settings for one chat. */
export interface ParticipantPreferences {
  mutedUntil?: Date | null;
  isPinned?: boolean;
  isArchived?: boolean;
}

export class ChatRepository {
  /**
   * Opens the direct chat between two people, or re-opens it: the pair key is
   * unique, so a chat either side previously "deleted for me" comes back with
   * both `leftAt` stamps cleared rather than duplicating.
   */
  async openDirectChat(userId: string, otherUserId: string, directKey: string) {
    return await prisma.chat.upsert({
      where: { directKey },
      create: {
        type: ChatType.DIRECT,
        directKey,
        createdBy: { connect: { id: userId } },
        participants: {
          create: [
            {
              role: ParticipantRole.MEMBER,
              user: { connect: { id: userId } },
            },
            {
              role: ParticipantRole.MEMBER,
              user: { connect: { id: otherUserId } },
            },
          ],
        },
      },
      update: {
        participants: {
          updateMany: {
            where: { userId: { in: [userId, otherUserId] } },
            data: { leftAt: null },
          },
        },
      },
      include: getChatInclude(),
    });
  }

  /** Creates a group with its roster; the creator is its first admin. */
  async createGroup(group: NewGroupChat) {
    return await prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        createdBy: { connect: { id: group.createdById } },
        participants: {
          create: group.participantIds.map((userId) => ({
            role:
              userId === group.createdById
                ? ParticipantRole.ADMIN
                : ParticipantRole.MEMBER,
            user: { connect: { id: userId } },
          })),
        },
      },
      include: getChatInclude(),
    });
  }

  /** A page of the chats this user is still in, most recently active first. */
  async findChatsForUser(userId: string, page: ChatPage) {
    return await prisma.chat.findMany({
      where: {
        participants: {
          some: { userId, leftAt: null },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      ...page,
      include: getChatInclude(),
    });
  }

  /** One chat with its roster and the last `messageTake` messages. */
  async findByIdWithMessages(chatId: string, messageTake: number) {
    return await prisma.chat.findUnique({
      where: { id: chatId },
      include: getChatInclude(messageTake),
    });
  }

  /** One chat with its roster and latest message — the broadcast shape. */
  async findByIdWithParticipants(chatId: string) {
    return await prisma.chat.findUnique({
      where: { id: chatId },
      include: getChatInclude(),
    });
  }

  /** Just the kind — the guard every group-only action starts with. */
  async findChatType(chatId: string) {
    return await prisma.chat.findUnique({
      where: { id: chatId },
      select: { type: true },
    });
  }

  /** Kind plus creator, for deletion's "admin or creator" check. */
  async findChatTypeAndCreator(chatId: string) {
    return await prisma.chat.findUnique({
      where: { id: chatId },
      select: { type: true, createdById: true },
    });
  }

  async updateGroup(chatId: string, edit: GroupChatEdit) {
    return await prisma.chat.update({
      where: { id: chatId },
      data: edit,
      include: getChatInclude(),
    });
  }

  async deleteById(chatId: string) {
    return await prisma.chat.delete({ where: { id: chatId } });
  }

  /** The caller's own membership row, or null once they've left. */
  async findActiveParticipant(chatId: string, userId: string) {
    return await prisma.chatParticipant.findFirst({
      where: { chatId, userId, leftAt: null },
    });
  }

  /** Adds a member, or clears the `leftAt` of one who was removed before. */
  async addOrRestoreParticipant(chatId: string, userId: string) {
    return await prisma.chatParticipant.upsert({
      where: { chatId_userId: { chatId, userId } },
      create: {
        role: ParticipantRole.MEMBER,
        chat: { connect: { id: chatId } },
        user: { connect: { id: userId } },
      },
      update: {
        role: ParticipantRole.MEMBER,
        leftAt: null,
      },
      include: participantInclude,
    });
  }

  /** Stamps a member as gone — used by both "remove" and "delete for me". */
  async markParticipantLeft(chatId: string, userId: string) {
    return await prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: { leftAt: new Date() },
      include: participantInclude,
    });
  }

  async setParticipantPreferences(
    chatId: string,
    userId: string,
    preferences: ParticipantPreferences,
  ) {
    return await prisma.chatParticipant.update({
      where: { chatId_userId: { chatId, userId } },
      data: preferences,
      include: participantInclude,
    });
  }

  countActiveParticipants(chatId: string) {
    return prisma.chatParticipant.count({
      where: { chatId, leftAt: null },
    });
  }

  /** True when the user is still a member of the chat. */
  async isActiveParticipant(chatId: string, userId: string): Promise<boolean> {
    const participant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { leftAt: true },
    });
    return participant !== null && participant.leftAt === null;
  }

  /** Every chat the user is still in. */
  findActiveChatIds(userId: string) {
    return prisma.chatParticipant.findMany({
      where: { userId, leftAt: null },
      select: { chatId: true },
    });
  }

  /** Active members of these chats, minus one user — one query however many
   *  chats are passed. */
  findActiveParticipants(chatIds: string[], exceptUserId: string) {
    return prisma.chatParticipant.findMany({
      where: {
        chatId: { in: chatIds },
        leftAt: null,
        userId: { not: exceptUserId },
      },
      select: { chatId: true, userId: true },
    });
  }

  /** Every active membership held by any of these users. */
  findActiveMemberships(userIds: string[]) {
    return prisma.chatParticipant.findMany({
      where: { userId: { in: userIds }, leftAt: null },
      select: { chatId: true, userId: true },
    });
  }

  /** Moves a member's read pointer. `updateMany` so a user who has since left
   *  the chat is a no-op rather than an error. */
  setLastReadMessage(chatId: string, userId: string, messageId: string) {
    return prisma.chatParticipant.updateMany({
      where: { chatId, userId, leftAt: null },
      data: { lastReadMessageId: messageId },
    });
  }
}
