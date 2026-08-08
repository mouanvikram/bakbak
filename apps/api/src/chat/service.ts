import { ChatType, ParticipantRole, Prisma } from "@sealchat/db"; //modified
import type { ChatRepository } from "./repository";
import type {
  ChatIdDto,
  CreateDirectChatDto,
  CreateGroupChatDto,
  ListChatsDto,
  ParticipantDto,
  UpdateChatDto,
} from "./types"; //modified

const chatUserSelect = { //modified
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

const getChatInclude = (messageTake = 1) => ({ //modified
  createdBy: {
    select: chatUserSelect,
  },
  participants: {
    where: {
      leftAt: null,
    },
    select: {
      id: true,
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
      deleted: false,
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

const participantInclude = { //modified
  user: {
    select: chatUserSelect,
  },
} satisfies Prisma.ChatParticipantInclude;

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}

  private getDirectKey(userId: string, participantId: string) { //modified
    return [userId, participantId].sort().join(":");
  }

  private async requireActiveParticipant(chatId: string, userId: string) { //modified
    const participant = await this.chatRepository.findParticipant({
      where: {
        chatId,
        userId,
        leftAt: null,
      },
    });

    if (!participant) {
      throw new Error("You are not a participant in this chat");
    }

    return participant;
  }

  private async requireGroupAdmin(chatId: string, userId: string) { //modified
    const participant = await this.requireActiveParticipant(chatId, userId);

    if (participant.role !== ParticipantRole.ADMIN) {
      throw new Error("Only group admins can perform this action");
    }

    return participant;
  }

  createDirectChat = async (dto: CreateDirectChatDto) => { //modified
    if (dto.currentUserId === dto.participantId) {
      throw new Error("Cannot create a direct chat with yourself");
    }

    const directKey = this.getDirectKey(dto.currentUserId, dto.participantId);

    const chat = await this.chatRepository.upsert({
      where: {
        directKey,
      },
      create: {
        type: ChatType.DIRECT,
        directKey,
        createdBy: {
          connect: {
            id: dto.currentUserId,
          },
        },
        participants: {
          create: [
            {
              role: ParticipantRole.MEMBER,
              user: {
                connect: {
                  id: dto.currentUserId,
                },
              },
            },
            {
              role: ParticipantRole.MEMBER,
              user: {
                connect: {
                  id: dto.participantId,
                },
              },
            },
          ],
        },
      },
      update: {
        participants: {
          updateMany: {
            where: {
              userId: {
                in: [dto.currentUserId, dto.participantId],
              },
            },
            data: {
              leftAt: null,
            },
          },
        },
      },
      include: getChatInclude(),
    });

    return chat;
  };

  createGroupChat = async (dto: CreateGroupChatDto) => { //modified
    const name = dto.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    const participantIds = Array.from(
      new Set([dto.currentUserId, ...dto.participantIds]),
    );

    if (participantIds.length < 2) {
      throw new Error("A group chat needs at least one other member");
    }

    return await this.chatRepository.create({
      data: {
        type: ChatType.GROUP,
        name,
        avatar: dto.avatar,
        createdBy: {
          connect: {
            id: dto.currentUserId,
          },
        },
        participants: {
          create: participantIds.map((userId) => ({
            role:
              userId === dto.currentUserId
                ? ParticipantRole.ADMIN
                : ParticipantRole.MEMBER,
            user: {
              connect: {
                id: userId,
              },
            },
          })),
        },
      },
      include: getChatInclude(),
    });
  };

  listChats = async (dto: ListChatsDto) => { //modified
    return await this.chatRepository.findMany({
      where: {
        participants: {
          some: {
            userId: dto.currentUserId,
            leftAt: null,
          },
        },
      },
      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
      skip: dto.cursor ? 1 : undefined,
      take: dto.limit ?? 30,
      include: getChatInclude(),
    });
  };

  getChat = async (dto: ChatIdDto) => { //modified
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const chat = await this.chatRepository.findUnique({
      where: {
        id: dto.chatId,
      },
      include: getChatInclude(30),
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    return chat;
  };

  updateChat = async (dto: UpdateChatDto) => { //modified
    const chat = await this.chatRepository.findUnique({
      where: {
        id: dto.chatId,
      },
      select: {
        type: true,
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    if (chat.type !== ChatType.GROUP) {
      throw new Error("Only group chats can be updated");
    }

    await this.requireGroupAdmin(dto.chatId, dto.currentUserId);

    const data: Prisma.ChatUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new Error("Group name is required");
      }
      data.name = name;
    }
    if (dto.avatar !== undefined) {
      data.avatar = dto.avatar;
    }

    if (!data.name && data.avatar === undefined) {
      throw new Error("Nothing to update");
    }

    return await this.chatRepository.update({
      where: {
        id: dto.chatId,
      },
      data,
      include: getChatInclude(),
    });
  };

  addParticipant = async (dto: ParticipantDto) => { //modified
    const chat = await this.chatRepository.findUnique({
      where: {
        id: dto.chatId,
      },
      select: {
        type: true,
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    if (chat.type !== ChatType.GROUP) {
      throw new Error("Members can only be added to group chats");
    }

    await this.requireGroupAdmin(dto.chatId, dto.currentUserId);

    return await this.chatRepository.upsertParticipant({
      where: {
        chatId_userId: {
          chatId: dto.chatId,
          userId: dto.participantId,
        },
      },
      create: {
        role: ParticipantRole.MEMBER,
        chat: {
          connect: {
            id: dto.chatId,
          },
        },
        user: {
          connect: {
            id: dto.participantId,
          },
        },
      },
      update: {
        role: ParticipantRole.MEMBER,
        leftAt: null,
      },
      include: participantInclude,
    });
  };

  removeParticipant = async (dto: ParticipantDto) => { //modified
    const chat = await this.chatRepository.findUnique({
      where: {
        id: dto.chatId,
      },
      select: {
        type: true,
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    if (chat.type !== ChatType.GROUP) {
      throw new Error("Members can only be removed from group chats");
    }

    if (dto.currentUserId !== dto.participantId) {
      await this.requireGroupAdmin(dto.chatId, dto.currentUserId);
    } else {
      await this.requireActiveParticipant(dto.chatId, dto.currentUserId);
    }

    return await this.chatRepository.updateParticipant({
      where: {
        chatId_userId: {
          chatId: dto.chatId,
          userId: dto.participantId,
        },
      },
      data: {
        leftAt: new Date(),
      },
      include: participantInclude,
    });
  };

  deleteChat = async (dto: ChatIdDto) => { //modified
    const participant = await this.requireActiveParticipant(
      dto.chatId,
      dto.currentUserId,
    );

    const chat = await this.chatRepository.findUnique({
      where: {
        id: dto.chatId,
      },
      select: {
        type: true,
        createdById: true,
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    if (
      chat.type === ChatType.GROUP &&
      participant.role !== ParticipantRole.ADMIN &&
      chat.createdById !== dto.currentUserId
    ) {
      throw new Error("Only group admins can delete this chat");
    }

    return await this.chatRepository.delete({
      where: {
        id: dto.chatId,
      },
    });
  };
}
