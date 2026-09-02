import { MessageType } from "@bakbak/contracts";
import { Prisma } from "@bakbak/db";
import type { MessageRepository } from "./repository";
import type {
	ChatMessagesDto,
	EditMessageDto,
	MarkChatReadDto,
	MessageIdDto,
	SearchMessagesDto,
	SendMessageDto,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import type { StorageProvider } from "../uploads/storage.provider";
import { resolveAvatarUrl } from "../uploads/avatar-url";

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
} satisfies Prisma.MessageInclude;

export class MessageService {
	constructor(
		private readonly messageRepository: MessageRepository,
		private readonly storageProvider: StorageProvider,
	) {}

	private async serializeMessage<
		T extends {
			createdAt: Date;
			updatedAt: Date;
			sender?: { profile?: { avatar?: string | null } | null };
		},
	>(message: T) {
		const serialized = {
			...message,
			createdAt: message.createdAt.toISOString(),
			updatedAt: message.updatedAt.toISOString(),
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

		const text = dto.text?.trim();
		if (dto.type === MessageType.TEXT && !text) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Message text is required",
			);
		}
		// Non-TEXT types may omit text: the media payload will live on the
		// attachment (uploads module), text acts as an optional caption.

		const message = await this.messageRepository.createWithChatTouch({
			data: {
				type: dto.type,
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

		return await this.serializeMessage(message);
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

		return await this.serializeMessage(updated);
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

		return await this.serializeMessage(deleted);
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
