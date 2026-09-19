import { MessageType } from "@bakbak/contracts";
import { Prisma, type AttachmentKind } from "@bakbak/db";
import type { MessageRepository } from "./repository";
import type { UploadRepository } from "@/uploads/repository";
import type { PushService } from "@/push/service";
import type {
  ChatMessagesDto,
  EditMessageDto,
  MarkChatReadDto,
  MessageIdDto,
  MessageResponseType,
  SearchMessagesDto,
  SendMessageDto,
  ToggleReactionDto,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { StorageProvider } from "@/uploads/storage.provider";
import { resolveAvatarUrl } from "@/uploads/avatar-url";
import { cursorPaginationArgs } from "@/lib/pagination";
import { toIso } from "@/lib/dates";
import { messagesConfig } from "./config";
import { uploadsConfig } from "@/uploads/config";

// Non-TEXT message types, keyed by the attachment kind that implies them.
const KIND_TO_MESSAGE_TYPE: Record<AttachmentKind, MessageType> = {
  IMAGE: MessageType.IMAGE,
  VIDEO: MessageType.VIDEO,
  AUDIO: MessageType.AUDIO,
  FILE: MessageType.FILE,
  STICKER: MessageType.STICKER,
};
import {
  broadcastMessage,
  broadcastMessageEdited,
  broadcastMessageDeleted,
  broadcastMessageReaction,
  broadcastReadReceipt,
} from "@/websocket/emitter";

type SerializedMessage = {
  [key: string]: unknown;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: Array<{
    id: string;
    kind: AttachmentKind;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    url: string;
    createdAt: string;
  }>;
  reactions: Array<{
    id: string;
    emoji: string;
    userId: string;
    messageId: string;
    createdAt: string;
  }>;
  sender?: { profile?: { avatar: string | null } | null } | null;
  replyTo?: SerializedMessage | null;
};

export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly storageProvider: StorageProvider,
    private readonly uploadRepository: UploadRepository,
    private readonly pushService: PushService,
  ) {}

  private async serializeAttachment(attachment: {
    id: string;
    kind: AttachmentKind;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    createdAt: Date;
  }) {
    return {
      id: attachment.id,
      kind: attachment.kind,
      fileName: attachment.fileName,
      filePath: attachment.filePath,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      width: attachment.width,
      height: attachment.height,
      url: await this.storageProvider.getSignedUrl(
        attachment.filePath,
        messagesConfig.attachmentUrlTtlSeconds,
      ),
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  private async serializeMessage<
    T extends {
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      sender?: { profile?: { avatar?: string | null } | null };
      attachments?: Array<{
        id: string;
        kind: AttachmentKind;
        fileName: string;
        filePath: string;
        mimeType: string;
        fileSize: number;
        width: number | null;
        height: number | null;
        createdAt: Date;
      }>;
      replyTo?: {
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        sender?: { profile?: { avatar?: string | null } | null };
        attachments?: Array<{
          id: string;
          kind: AttachmentKind;
          fileName: string;
          filePath: string;
          mimeType: string;
          fileSize: number;
          width: number | null;
          height: number | null;
          createdAt: Date;
        }>;
      } | null;
      reactions?: Array<{
        id: string;
        emoji: string;
        userId: string;
        messageId: string;
        createdAt: Date;
      }>;
      call?: {
        id: string;
        type: "AUDIO" | "VIDEO";
        status: "RINGING" | "ANSWERED" | "MISSED" | "DECLINED" | "FAILED";
        callerId: string;
        startedAt: Date;
        answeredAt: Date | null;
        endedAt: Date | null;
      } | null;
    },
  >(message: T): Promise<SerializedMessage> {
    const replyTo =
      message.replyTo != null
        ? await this.serializeMessage(message.replyTo)
        : undefined;
    const serialized = {
      ...message,
      deleted: message.deletedAt !== null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      attachments: message.attachments
        ? await Promise.all(
            message.attachments.map((attachment) =>
              this.serializeAttachment(attachment),
            ),
          )
        : [],
      reactions:
        message.reactions?.map((reaction) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          messageId: reaction.messageId,
          createdAt: reaction.createdAt.toISOString(),
        })) ?? [],
      ...(replyTo !== undefined ? { replyTo } : {}),
      // Duration is derived here rather than stored, so it can never disagree
      // with the timestamps. Only a connected call has one: a missed call sat
      // ringing but lasted no time at all.
      ...(message.call
        ? {
            call: {
              id: message.call.id,
              type: message.call.type,
              status: message.call.status,
              callerId: message.call.callerId,
              startedAt: message.call.startedAt.toISOString(),
              answeredAt: message.call.answeredAt?.toISOString() ?? null,
              endedAt: message.call.endedAt?.toISOString() ?? null,
              durationSeconds:
                message.call.answeredAt && message.call.endedAt
                  ? Math.max(
                      0,
                      Math.round(
                        (message.call.endedAt.getTime() -
                          message.call.answeredAt.getTime()) / 1000,
                      ),
                    )
                  : null,
            },
          }
        : {}),
    };
    if (serialized.sender?.profile?.avatar !== undefined) {
      serialized.sender.profile.avatar = await resolveAvatarUrl(
        serialized.sender.profile.avatar,
        this.storageProvider,
      );
    }
    return serialized as SerializedMessage;
  }

  private async serializeParticipant<
    T extends {
      joinedAt: Date;
      mutedUntil: Date | null;
      leftAt: Date | null;
      user?: { profile?: { avatar?: string | null } | null };
    },
  >(participant: T) {
    const serialized = {
      ...participant,
      joinedAt: participant.joinedAt.toISOString(),
      mutedUntil: toIso(participant.mutedUntil),
      leftAt: toIso(participant.leftAt),
    };
    if (serialized.user?.profile?.avatar !== undefined) {
      serialized.user.profile.avatar = await resolveAvatarUrl(
        serialized.user.profile.avatar,
        this.storageProvider,
      );
    }
    return serialized;
  }

  private async requireActiveParticipant(chatId: string, userId: string) {
    const participant = await this.messageRepository.findActiveParticipant(
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

  private async requireVisibleMessage(messageId: string) {
    const message = await this.messageRepository.findByIdWithDetail(messageId);

    if (!message || message.deletedAt) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found",
      );
    }

    return message;
  }

  async sendMessage(dto: SendMessageDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    // Idempotent retry: same sender + clientId returns the original message.
    // clientId is only unique per sender, not per chat, so a reused id
    // pointing at a different chat is a client bug — reject it rather than
    // silently handing back the wrong chat's message.
    if (dto.clientId) {
      const existing = await this.messageRepository.findByClientId(
        dto.currentUserId,
        dto.clientId,
      );
      if (existing) {
        if (existing.chatId !== dto.chatId) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.CONFLICT,
            "This clientId was already used for a different chat",
          );
        }
        return await this.serializeMessage(existing);
      }
    }

    if (dto.replyToId) {
      const target = await this.requireVisibleMessage(dto.replyToId);
      if (target.chatId !== dto.chatId) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Cannot reply to a message from a different chat",
        );
      }
    }

    const attachmentIds = dto.attachmentIds ?? [];
    const attachments = attachmentIds.length
      ? await this.loadOwnedUnlinkedAttachments(
          attachmentIds,
          dto.currentUserId,
        )
      : [];

    // A send is unbounded otherwise: the per-upload caps bound one file, not
    // the batch, so ten max-size videos could go out as a single 200MB message.
    const totalBytes = attachments.reduce(
      (sum, attachment) => sum + attachment.fileSize,
      0,
    );
    if (totalBytes > uploadsConfig.maxMessageBytes) {
      const limitMb = Math.round(uploadsConfig.maxMessageBytes / (1024 * 1024));
      throw new AppError(
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `This message's attachments total more than ${limitMb} MB. Split the files across messages.`,
      );
    }

    const text = dto.text?.trim();
    // Attachment messages take their type from the first file.
    const type = attachments[0]
      ? (KIND_TO_MESSAGE_TYPE[attachments[0].kind] ?? MessageType.FILE)
      : dto.type;

    if (type === MessageType.TEXT && !text && attachments.length === 0) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Message text is required",
      );
    }
    // Non-TEXT types may omit text; it acts as an optional caption.

    const message = await this.createMessageRow({
      type,
      text,
      clientId: dto.clientId,
      chatId: dto.chatId,
      senderId: dto.currentUserId,
      replyToId: dto.replyToId,
    });

    if (attachments.length) {
      await this.uploadRepository.linkManyToMessage(attachmentIds, message.id);
    }

    // Re-read so the broadcast/response carries the linked attachments.
    const full = attachments.length
      ? ((await this.messageRepository.findByIdWithDetail(message.id)) ??
        message)
      : message;

    const serialized = await this.serializeMessage(full);

    try {
      broadcastMessage(dto.chatId, serialized as MessageResponseType);
    } catch {
      // WebSocket may not be initialised in test runners.
    }

    // Offline recipients get a web push; online ones already saw the socket
    // event above. Fire-and-forget so deliverability can never fail the send.
    void this.pushService
      .notifyMessage({ chatId: dto.chatId, message: serialized as MessageResponseType })
      .catch(() => {});

    return serialized;
  }

  // Returns the existing row if a concurrent same-clientId insert won the race.
  private async createMessageRow(row: {
    type: MessageType;
    text: string | undefined;
    clientId: string;
    chatId: string;
    senderId: string;
    replyToId?: string;
  }) {
    try {
      return await this.messageRepository.createMessage(row);
    } catch (error) {
      if (
        row.clientId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.messageRepository.findByClientId(
          row.senderId,
          row.clientId,
        );
        if (existing && existing.chatId === row.chatId) return existing;
        if (existing) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.CONFLICT,
            "This clientId was already used for a different chat",
          );
        }
      }
      throw error;
    }
  }

  // Every id must exist, be unattached, and belong to the sender
  // (storage keys are namespaced by userId).
  private async loadOwnedUnlinkedAttachments(
    attachmentIds: string[],
    userId: string,
  ) {
    const attachments =
      await this.uploadRepository.findManyByIds(attachmentIds);

    if (attachments.length !== new Set(attachmentIds).size) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ATTACHMENT_NOT_FOUND,
        "One or more attachments could not be found",
      );
    }

    for (const attachment of attachments) {
      if (attachment.messageId) {
        throw new AppError(
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR,
          "Attachment is already attached to a message",
        );
      }
      if (!attachment.filePath.startsWith(`${userId}/`)) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.FORBIDDEN,
          "You can only attach files you uploaded",
        );
      }
    }

    return attachments;
  }

  async listMessages(dto: ChatMessagesDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const { cursor, skip, take } = cursorPaginationArgs(dto.cursor, dto.limit);

    const messages = await this.messageRepository.findChatMessages(dto.chatId, {
      cursor,
      skip,
      take,
    });

    return Promise.all(
      messages.map((message) => this.serializeMessage(message)),
    );
  }

  async getMessage(dto: MessageIdDto) {
    const message = await this.requireVisibleMessage(dto.messageId);
    await this.requireActiveParticipant(message.chatId, dto.currentUserId);

    return await this.serializeMessage(message);
  }

  /**
   * A serialized message for a server-initiated broadcast — currently the
   * timeline entry the call service writes when a call ends.
   *
   * Unlike getMessage there is no requesting user to authorize against: the
   * server wrote this row itself and is pushing it to a chat room whose
   * membership the socket layer already enforces. Never reachable from a
   * route, so it cannot be used to read another chat's message.
   */
  async getMessageForBroadcast(
    messageId: string,
  ): Promise<MessageResponseType | null> {
    const message = await this.messageRepository.findByIdWithDetail(messageId);
    if (!message) return null;
    return (await this.serializeMessage(message)) as MessageResponseType;
  }

  /** Add a reaction, or remove it if the sender already used that emoji. */
  async toggleReaction(dto: ToggleReactionDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const message = await this.requireVisibleMessage(dto.messageId);
    if (message.chatId !== dto.chatId) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot react to a message from a different chat",
      );
    }

    const existing = await this.messageRepository.findReaction(
      dto.messageId,
      dto.currentUserId,
      dto.emoji,
    );
    if (existing) {
      await this.messageRepository.deleteReaction(existing.id);
    } else {
      await this.messageRepository.createReaction(
        dto.messageId,
        dto.currentUserId,
        dto.emoji,
      );
    }

    const updated = await this.messageRepository.findByIdWithDetail(
      dto.messageId,
    );
    const serialized = await this.serializeMessage(updated ?? message);

    try {
      broadcastMessageReaction(dto.chatId, serialized as MessageResponseType);
    } catch {
      // WebSocket may not be initialised in test runners.
    }

    return serialized;
  }

  async editMessage(dto: EditMessageDto) {
    const text = dto.text.trim();
    if (!text) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Message text is required",
      );
    }

    const message = await this.requireVisibleMessage(dto.messageId);
    await this.requireActiveParticipant(message.chatId, dto.currentUserId);

    if (message.senderId !== dto.currentUserId) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "Only the sender can edit this message",
      );
    }

    const updated = await this.messageRepository.updateText(
      dto.messageId,
      text,
    );

    const serialized = await this.serializeMessage(updated);

    try {
      broadcastMessageEdited(message.chatId, serialized as MessageResponseType);
    } catch {
      // WebSocket may not be initialised in test runners.
    }

    return serialized;
  }

  async deleteMessage(dto: MessageIdDto) {
    const message = await this.requireVisibleMessage(dto.messageId);
    await this.requireActiveParticipant(message.chatId, dto.currentUserId);

    if (message.senderId !== dto.currentUserId) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "Only the sender can delete this message",
      );
    }

    const deleted = await this.messageRepository.markDeleted(dto.messageId);

    const serialized = await this.serializeMessage(deleted);

    try {
      broadcastMessageDeleted(
        message.chatId,
        serialized as MessageResponseType,
      );
    } catch {
      // WebSocket may not be initialised in test runners.
    }

    return serialized;
  }

  async markChatRead(dto: MarkChatReadDto) {
    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const messageId =
      dto.messageId ??
      (await this.messageRepository.findLatestMessageId(dto.chatId));

    if (!messageId) {
      const participant = await this.messageRepository.setLastReadMessage(
        dto.chatId,
        dto.currentUserId,
        null,
      );

      // Nothing to acknowledge in an empty chat — no receipt to broadcast.
      return await this.serializeParticipant(participant);
    }

    const exists = await this.messageRepository.messageExistsInChat(
      messageId,
      dto.chatId,
    );

    if (!exists) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.MESSAGE_NOT_FOUND,
        "Message not found in this chat",
      );
    }

    const participant = await this.messageRepository.setLastReadMessage(
      dto.chatId,
      dto.currentUserId,
      messageId,
    );

    try {
      broadcastReadReceipt(dto.chatId, dto.currentUserId, messageId);
    } catch {
      // WebSocket may not be initialised in test runners.
    }

    return await this.serializeParticipant(participant);
  }

  async searchMessages(dto: SearchMessagesDto) {
    const query = dto.query.trim();
    if (!query) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        "Search query is required",
      );
    }

    await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

    const { cursor, skip, take } = cursorPaginationArgs(dto.cursor, dto.limit);

    const messages = await this.messageRepository.searchChatMessages(
      dto.chatId,
      query,
      { cursor, skip, take },
    );

    return Promise.all(
      messages.map((message) => this.serializeMessage(message)),
    );
  }

  async getUnreadCount(dto: ChatMessagesDto) {
    const participant = await this.requireActiveParticipant(
      dto.chatId,
      dto.currentUserId,
    );

    const since = participant.lastReadMessageId
      ? await this.messageRepository.findMessageTimestamp(
          participant.lastReadMessageId,
          dto.chatId,
        )
      : null;

    return await this.messageRepository.countUnread(
      dto.chatId,
      dto.currentUserId,
      since,
    );
  }
}
