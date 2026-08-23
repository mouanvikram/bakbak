import { MessageType, Prisma } from "@bakbak/db"; //modified
import type { MessageRepository } from "./repository";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import type {
	ChatMessagesDto,
	EditMessageDto,
	MarkChatReadDto,
	MessageIdDto,
	SearchMessagesDto,
	SendMessageDto,
} from "./types"; //modified

const messageUserSelect = {
	//modified
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
	//modified
	sender: {
		select: messageUserSelect,
	},
} satisfies Prisma.MessageInclude;

export class MessageService {
	//modified
	constructor(private readonly messageRepository: MessageRepository) {}

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

		if (dto.type !== MessageType.TEXT && !text) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Message content is required",
			);
		}

		const message = await this.messageRepository.create({
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

		await this.messageRepository.updateChat({
			where: {
				id: dto.chatId,
			},
			data: {
				lastMessageAt: message.createdAt,
			},
		});

		return message;
	}

	async listMessages(dto: ChatMessagesDto) {
		await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

		return await this.messageRepository.findMany({
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
	}

	async getMessage(dto: MessageIdDto) {
		const message = await this.requireVisibleMessage(dto.messageId);
		await this.requireActiveParticipant(message.chatId, dto.currentUserId);

		return message;
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

		return await this.messageRepository.update({
			where: {
				id: dto.messageId,
			},
			data: {
				text,
				type: MessageType.TEXT,
			},
			include: messageInclude,
		});
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

		return await this.messageRepository.update({
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
			return await this.messageRepository.updateParticipant({
				where: {
					chatId_userId: {
						chatId: dto.chatId,
						userId: dto.currentUserId,
					},
				},
				data: {
					lastReadMessageId: null,
				},
			});
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

		return await this.messageRepository.updateParticipant({
			where: {
				chatId_userId: {
					chatId: dto.chatId,
					userId: dto.currentUserId,
				},
			},
			data: {
				lastReadMessageId: message.id,
			},
		});
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

		return await this.messageRepository.findMany({
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
