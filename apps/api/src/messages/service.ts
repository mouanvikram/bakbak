import { MessageType } from "@bakbak/contracts";
import { Prisma, type AttachmentKind } from "@bakbak/db";
import type { MessageRepository } from "./repository";
import type { UploadRepository } from "../uploads/repository";
import type {
	ChatMessagesDto,
	EditMessageDto,
	MarkChatReadDto,
	MessageIdDto,
	SearchMessagesDto,
	SendMessageDto,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { StorageProvider } from "../uploads/storage.provider";
import { resolveAvatarUrl } from "../uploads/avatar-url";

const ATTACHMENT_URL_TTL_SECONDS = 3600;

/** Attachment kinds line up 1:1 with the non-TEXT message types they imply. */
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
	broadcastReadReceipt,
} from "../websocket/emitter";

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

const messageInclude = {
	sender: {
		select: messageUserSelect,
	},
	attachments: true,
} satisfies Prisma.MessageInclude;

export class MessageService {
	constructor(
		private readonly messageRepository: MessageRepository,
		private readonly storageProvider: StorageProvider,
		private readonly uploadRepository: UploadRepository,
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
		duration: number | null;
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
			duration: attachment.duration,
			url: await this.storageProvider.getSignedUrl(
				attachment.filePath,
				ATTACHMENT_URL_TTL_SECONDS,
			),
			createdAt: attachment.createdAt.toISOString(),
		};
	}

	private async serializeMessage<
		T extends {
			createdAt: Date;
			updatedAt: Date;
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
				duration: number | null;
				createdAt: Date;
			}>;
		},
	>(message: T) {
		const serialized = {
			...message,
			createdAt: message.createdAt.toISOString(),
			updatedAt: message.updatedAt.toISOString(),
			attachments: message.attachments
				? await Promise.all(
						message.attachments.map((attachment) =>
							this.serializeAttachment(attachment),
						),
					)
				: [],
		};
		if (serialized.sender?.profile?.avatar !== undefined) {
			serialized.sender.profile.avatar = await resolveAvatarUrl(
				serialized.sender.profile.avatar,
				this.storageProvider,
			);
		}
		return serialized;
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
			mutedUntil: participant.mutedUntil?.toISOString() ?? null,
			leftAt: participant.leftAt?.toISOString() ?? null,
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
		const participant = await this.messageRepository.findParticipant({
			where: {
				chatId,
				userId,
				leftAt: null,
			},
		});

		if (!participant) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.FORBIDDEN,
				"You are not a participant in this chat",
			);
		}

		return participant;
	}

	private async requireVisibleMessage(messageId: string) {
		const message = await this.messageRepository.findUnique({
			where: {
				id: messageId,
			},
			include: messageInclude,
		});

		if (!message || message.deleted) {
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

		const attachmentIds = dto.attachmentIds ?? [];
		const attachments = attachmentIds.length
			? await this.loadOwnedUnlinkedAttachments(
					attachmentIds,
					dto.currentUserId,
				)
			: [];

		const text = dto.text?.trim();
		// An attachment message takes its type from the first file; a plain
		// message keeps whatever the caller asked for (default TEXT).
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
		// Non-TEXT types may omit text: the media payload lives on the
		// attachment, and text acts as an optional caption.

		const message = await this.messageRepository.createWithChatTouch({
			data: {
				type,
				text,
				chat: {
					connect: {
						id: dto.chatId,
					},
				},
				sender: {
					connect: {
						id: dto.currentUserId,
					},
				},
			},
			include: messageInclude,
		});

		if (attachments.length) {
			await this.uploadRepository.linkManyToMessage(attachmentIds, message.id);
		}

		// Re-read once so the broadcast/response carries the linked attachments.
		const full = attachments.length
			? ((await this.messageRepository.findUnique({
					where: { id: message.id },
					include: messageInclude,
				})) ?? message)
			: message;

		const serialized = await this.serializeMessage(full);

		try {
			broadcastMessage(dto.chatId, serialized);
		} catch {
			// WebSocket may not be initialised in test runners.
		}

		return serialized;
	}

	/**
	 * Load the attachments the sender wants to attach, rejecting the request
	 * unless every id exists, is still unattached, and belongs to the sender
	 * (storage keys are namespaced by userId).
	 */
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

		const messages = await this.messageRepository.findMany({
			where: {
				chatId: dto.chatId,
				deleted: false,
			},
			orderBy: {
				createdAt: "desc",
			},
			cursor: dto.cursor ? { id: dto.cursor } : undefined,
			skip: dto.cursor ? 1 : undefined,
			take: dto.limit ?? 50,
			include: messageInclude,
		});

		return Promise.all(messages.map((message) => this.serializeMessage(message)));
	}

	async getMessage(dto: MessageIdDto) {
		const message = await this.requireVisibleMessage(dto.messageId);
		await this.requireActiveParticipant(message.chatId, dto.currentUserId);

		return await this.serializeMessage(message);
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

		const updated = await this.messageRepository.update({
			where: {
				id: dto.messageId,
			},
			data: {
				text,
				// keep the original type — editing a caption must not
				// silently convert an IMAGE/VIDEO message into TEXT
			},
			include: messageInclude,
		});

		const serialized = await this.serializeMessage(updated);

		try {
			broadcastMessageEdited(message.chatId, serialized);
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

		const deleted = await this.messageRepository.update({
			where: {
				id: dto.messageId,
			},
			data: {
				deleted: true,
				deletedAt: new Date(),
				text: null,
			},
			include: messageInclude,
		});

		const serialized = await this.serializeMessage(deleted);

		try {
			broadcastMessageDeleted(message.chatId, serialized);
		} catch {
			// WebSocket may not be initialised in test runners.
		}

		return serialized;
	}

	async markChatRead(dto: MarkChatReadDto) {
		await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

		const messageId =
			dto.messageId ??
			(
				await this.messageRepository.findFirst({
					where: {
						chatId: dto.chatId,
						deleted: false,
					},
					orderBy: {
						createdAt: "desc",
					},
					select: {
						id: true,
					},
				})
			)?.id;

		if (!messageId) {
			const participant = await this.messageRepository.updateParticipant({
				where: {
					chatId_userId: {
						chatId: dto.chatId,
						userId: dto.currentUserId,
					},
				},
				data: {
					lastReadMessageId: null,
				},
				include: {
					user: {
						select: messageUserSelect,
					},
				},
			});

			try {
				if (messageId) {
					broadcastReadReceipt(dto.chatId, dto.currentUserId, messageId);
				}
			} catch {
				// WebSocket may not be initialised in test runners.
			}

			return await this.serializeParticipant(participant);
		}

		const message = await this.messageRepository.findFirst({
			where: {
				id: messageId,
				chatId: dto.chatId,
				deleted: false,
			},
			select: {
				id: true,
			},
		});

		if (!message) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.MESSAGE_NOT_FOUND,
				"Message not found in this chat",
			);
		}

		const participant = await this.messageRepository.updateParticipant({
			where: {
				chatId_userId: {
					chatId: dto.chatId,
					userId: dto.currentUserId,
				},
			},
			data: {
				lastReadMessageId: message.id,
			},
			include: {
				user: {
					select: messageUserSelect,
				},
			},
		});

		try {
			broadcastReadReceipt(dto.chatId, dto.currentUserId, message.id);
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

		const messages = await this.messageRepository.findMany({
			where: {
				chatId: dto.chatId,
				deleted: false,
				text: {
					contains: query,
					mode: "insensitive",
				},
			},
			orderBy: {
				createdAt: "desc",
			},
			cursor: dto.cursor ? { id: dto.cursor } : undefined,
			skip: dto.cursor ? 1 : undefined,
			take: dto.limit ?? 50,
			include: messageInclude,
		});

		return Promise.all(messages.map((message) => this.serializeMessage(message)));
	}

	async getUnreadCount(dto: ChatMessagesDto) {
		const participant = await this.requireActiveParticipant(
			dto.chatId,
			dto.currentUserId,
		);

		const lastReadMessage = participant.lastReadMessageId
			? await this.messageRepository.findFirst({
					where: {
						id: participant.lastReadMessageId,
						chatId: dto.chatId,
					},
					select: {
						createdAt: true,
					},
				})
			: null;

		return await this.messageRepository.count({
			where: {
				chatId: dto.chatId,
				deleted: false,
				senderId: {
					not: dto.currentUserId,
				},
				createdAt: lastReadMessage
					? {
							gt: lastReadMessage.createdAt,
						}
					: undefined,
			},
		});
	}
}
