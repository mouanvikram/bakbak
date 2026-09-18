import { ChatType, ParticipantRole } from "@bakbak/db";
import type { ChatRepository } from "./repository";
import type {
  ChatIdDto,
  CreateDirectChatDto,
  CreateGroupChatDto,
  ListChatsDto,
  ParticipantDto,
  UpdateChatDto,
  UpdateChatParticipantDto,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { StorageProvider } from "@/uploads/storage.provider";
import { resolveAvatarUrl } from "@/uploads/avatar-url";
import {
  addUsersToChatRoom,
  broadcastChatUpdated,
  clearChatRoom,
  removeUsersFromChatRoom,
} from "@/websocket/emitter";
import { toIso } from "@/lib/dates";
import { chatsConfig } from "./config";

export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  private serializeMessage<T extends { createdAt: Date; updatedAt: Date }>(
    message: T,
  ) {
    return {
      ...message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }

  private async resolveUserAvatar<
    U extends {
      profile?: {
        avatar?: string | null;
        lastSeenAt?: Date | string | null;
      } | null;
    },
  >(user: U): Promise<U> {
    const profile = user.profile;
    if (!profile) return user;

    if (profile.avatar !== undefined) {
      profile.avatar = await resolveAvatarUrl(
        profile.avatar,
        this.storageProvider,
      );
    }
    // Prisma returns the DateTime as a Date object; the response schema needs
    // an ISO string, so convert here — otherwise validateResponse 500s.
    if (profile.lastSeenAt instanceof Date) {
      profile.lastSeenAt = toIso(profile.lastSeenAt);
    }
    return user;
  }

  private async serializeParticipant<
    T extends {
      joinedAt: Date;
      mutedUntil: Date | null;
      leftAt?: Date | null;
      user?: { profile?: { avatar?: string | null } | null };
    },
  >(participant: T) {
    const serialized = {
      ...participant,
      joinedAt: participant.joinedAt.toISOString(),
      mutedUntil: toIso(participant.mutedUntil),
      leftAt: toIso(participant.leftAt),
    };
    if (serialized.user) {
      await this.resolveUserAvatar(serialized.user);
    }
    return serialized;
  }

  private async serializeChat<
    T extends {
      createdAt: Date;
      updatedAt: Date;
      avatar?: string | null;
      lastMessageAt?: Date | null;
      participants?: Array<{
        joinedAt: Date;
        mutedUntil: Date | null;
        leftAt?: Date | null;
        user?: { profile?: { avatar?: string | null } | null };
      }>;
      messages?: Array<{ createdAt: Date; updatedAt: Date }>;
      createdBy?: { profile?: { avatar?: string | null } | null } | null;
    },
  >(chat: T) {
    const participants = chat.participants
      ? await Promise.all(
          chat.participants.map((participant) =>
            this.serializeParticipant(participant),
          ),
        )
      : undefined;

    const createdBy = chat.createdBy
      ? await this.resolveUserAvatar(chat.createdBy)
      : undefined;

    const avatar =
      chat.avatar !== undefined
        ? await resolveAvatarUrl(chat.avatar, this.storageProvider)
        : undefined;

    return {
      ...chat,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      lastMessageAt: toIso(chat.lastMessageAt),
      ...(avatar !== undefined ? { avatar } : {}),
      createdBy,
      participants,
      messages: chat.messages?.map((message) => this.serializeMessage(message)),
    };
  }

  private getDirectKey(userId: string, participantId: string) {
    return [userId, participantId].sort().join(":");
  }

  private async requireActiveParticipant(chatId: string, userId: string) {
    const participant = await this.chatRepository.findActiveParticipant(
      chatId,
      userId,
    );

    if (!participant) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.CHAT_NOT_FOUND,
        "Chat not found",
      );
    }

    return participant;
  }

  private async requireGroupAdmin(chatId: string, userId: string) {
    const participant = await this.requireActiveParticipant(chatId, userId);

    if (participant.role !== ParticipantRole.ADMIN) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "Only group admins can perform this action",
      );
    }

    return participant;
  }

  async createDirectChat(dto: CreateDirectChatDto) {
    if (dto.currentUserId === dto.participantId) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot create a direct chat with yourself",
      );
    }

    const directKey = this.getDirectKey(dto.currentUserId, dto.participantId);

    const chat = await this.chatRepository.openDirectChat(
      dto.currentUserId,
      dto.participantId,
      directKey,
    );

    // Both sides' open sockets join the room, so the first message of a new
    // (or re-opened) conversation arrives live instead of after a reconnect.
    await addUsersToChatRoom([dto.currentUserId, dto.participantId], chat.id);

    return await this.serializeChat(chat);
  }

  async createGroupChat(dto: CreateGroupChatDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Group name is required",
      );
    }

    const participantIds = Array.from(
      new Set([dto.currentUserId, ...dto.participantIds]),
    );

    if (participantIds.length < 3) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "A group needs at least 3 people, including you",
      );
    }

    if (participantIds.length > chatsConfig.group.createMaxParticipants) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.GROUP_MAX_SIZE,
        `A group can have at most ${chatsConfig.group.createMaxParticipants} people at creation`,
      );
    }

    const chat = await this.chatRepository.createGroup({
      name,
      description: dto.description?.trim() || null,
      avatar: dto.avatar,
      createdById: dto.currentUserId,
      participantIds,
    });

    await addUsersToChatRoom(participantIds, chat.id);

    return await this.serializeChat(chat);
  }

  async listChats(dto: ListChatsDto) {
    const chats = await this.chatRepository.findChatsForUser(dto.currentUserId, {
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
      skip: dto.cursor ? 1 : undefined,
      take: dto.limit ?? 30,
    });

    return Promise.all(chats.map((chat) => this.serializeChat(chat)));
  }

  async getChat(dto: ChatIdDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const chat = await this.chatRepository.findByIdWithMessages(dto.chatId, 30);

    if (!chat) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.CHAT_NOT_FOUND,
        "Chat not found",
      );
    }

    return await this.serializeChat(chat);
  }

  async updateChat(dto: UpdateChatDto) {
    const chat = await this.chatRepository.findChatType(dto.chatId);

    if (!chat) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.CHAT_NOT_FOUND,
        "Chat not found",
      );
    }

    if (chat.type !== ChatType.GROUP) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Only group chats can be updated",
      );
    }

    await this.requireGroupAdmin(dto.chatId, dto.currentUserId);

    const data: {
      name?: string;
      avatar?: string | null;
      description?: string | null;
    } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Group name is required",
        );
      }
      data.name = name;
    }
    if (dto.avatar !== undefined) {
      data.avatar = dto.avatar;
    }
    if (dto.description !== undefined) {
      data.description =
        dto.description === null ? null : dto.description.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Nothing to update",
      );
    }

    const updated = await this.serializeChat(
      await this.chatRepository.updateGroup(dto.chatId, data),
    );

    broadcastChatUpdated(dto.chatId, updated);
    return updated;
  }

  // Re-read + broadcast the chat after a membership change.
  private async broadcastChatState(chatId: string) {
    const chat = await this.chatRepository.findByIdWithParticipants(chatId);
    if (chat) {
      broadcastChatUpdated(chatId, await this.serializeChat(chat));
    }
  }

  async addParticipant(dto: ParticipantDto) {
    const chat = await this.chatRepository.findChatType(dto.chatId);

    if (!chat) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.CHAT_NOT_FOUND,
        "Chat not found",
      );
    }

    if (chat.type !== ChatType.GROUP) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Members can only be added to group chats",
      );
    }

    await this.requireGroupAdmin(dto.chatId, dto.currentUserId);

    const activeCount = await this.chatRepository.countActiveParticipants(
      dto.chatId,
    );
    if (activeCount >= chatsConfig.group.maxParticipants) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.GROUP_MAX_SIZE,
        `This group is full (maximum of ${chatsConfig.group.maxParticipants} people)`,
      );
    }

    const participant = await this.chatRepository.addOrRestoreParticipant(
      dto.chatId,
      dto.participantId,
    );

    // Pull the new member's sockets into the room so they receive the
    // chat:updated below and every message from here on.
    await addUsersToChatRoom([dto.participantId], dto.chatId);
    await this.broadcastChatState(dto.chatId);

    return await this.serializeParticipant(participant);
  }

  async removeParticipant(dto: ParticipantDto) {
    const chat = await this.chatRepository.findChatType(dto.chatId);

    if (!chat) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.CHAT_NOT_FOUND,
        "Chat not found",
      );
    }

    if (chat.type !== ChatType.GROUP) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Members can only be removed from group chats",
      );
    }

    if (dto.currentUserId !== dto.participantId) {
      await this.requireGroupAdmin(dto.chatId, dto.currentUserId);
    } else {
      await this.requireActiveParticipant(dto.chatId, dto.currentUserId);
    }

    const participant = await this.chatRepository.markParticipantLeft(
      dto.chatId,
      dto.participantId,
    );

    await this.broadcastChatState(dto.chatId);
    // After the broadcast, so the removed member still receives chat:updated
    // (the client uses it to close the chat) and nothing from the room after.
    await removeUsersFromChatRoom([dto.participantId], dto.chatId);

    return await this.serializeParticipant(participant);
  }

  async updateParticipantSettings(dto: UpdateChatParticipantDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const data: {
      mutedUntil?: Date | null;
      isPinned?: boolean;
      isArchived?: boolean;
    } = {};
    if (dto.mutedUntil !== undefined) {
      data.mutedUntil = dto.mutedUntil ? new Date(dto.mutedUntil) : null;
    }
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

    const participant = await this.chatRepository.setParticipantPreferences(
      dto.chatId,
      dto.currentUserId,
      data,
    );

    return await this.serializeParticipant(participant);
  }

  // "Delete for me": drop the caller from the chat by stamping their
  // participant row's `leftAt`. The conversation disappears from their list
  // (see `listChats`' `leftAt: null` filter) while everyone else keeps it.
  // Re-opening a direct chat with the same person clears `leftAt` again.
  async leaveChat(dto: ChatIdDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    await this.chatRepository.markParticipantLeft(
      dto.chatId,
      dto.currentUserId,
    );

    const chat = await this.chatRepository.findChatType(dto.chatId);

    // Group members should see the roster change immediately; a direct
    // chat has nothing meaningful to broadcast.
    if (chat?.type === ChatType.GROUP) {
      await this.broadcastChatState(dto.chatId);
    }

    // The caller stops receiving this chat on every tab and device right away
    // — a direct chat too, since it's gone from their list.
    await removeUsersFromChatRoom([dto.currentUserId], dto.chatId);

    return { message: "Chat removed" };
  }

  async deleteChat(dto: ChatIdDto) {
    const participant = await this.requireActiveParticipant(
      dto.chatId,
      dto.currentUserId,
    );

    const chat = await this.chatRepository.findChatTypeAndCreator(dto.chatId);

    if (!chat) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.CHAT_NOT_FOUND,
        "Chat not found",
      );
    }

    if (chat.type !== ChatType.GROUP) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Only group chats can be deleted",
      );
    }

    if (
      participant.role !== ParticipantRole.ADMIN &&
      chat.createdById !== dto.currentUserId
    ) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "Only group admins can delete this chat",
      );
    }

    const chatDeleted = await this.chatRepository.deleteById(dto.chatId);

    const serialized = await this.serializeChat(chatDeleted);

    // Members learn through the usual `chat:updated`: an empty participant
    // list is what the client already treats as "you're not in this chat any
    // more", so it closes the conversation and drops it from the list. Sent
    // before the room is emptied, or nobody would receive it.
    broadcastChatUpdated(dto.chatId, { ...serialized, participants: [] });
    clearChatRoom(dto.chatId);

    return serialized;
  }
}
