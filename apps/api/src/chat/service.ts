import { ChatType, ParticipantRole, Prisma } from "@bakbak/db"; 
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
import type { StorageProvider } from "../uploads/storage.provider";
import { resolveAvatarUrl } from "../uploads/avatar-url";
import {
	addUserToChatRoom,
	broadcastChatUpdated,
} from "../websocket/emitter";

const chatUserSelect = {
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

	private async resolveUserAvatar<U extends {
		profile?: { avatar?: string | null } | null;
	}>(user: U): Promise<U> {
		const avatar = user.profile?.avatar;
		if (avatar !== undefined && user.profile) {
			user.profile.avatar = await resolveAvatarUrl(avatar, this.storageProvider);
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
			mutedUntil: participant.mutedUntil?.toISOString() ?? null,
			leftAt: participant.leftAt?.toISOString() ?? null,
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
			lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
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
		
		const participant = await this.chatRepository.findParticipant({
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

		const chat = await this.chatRepository.create({
			data: {
				type: ChatType.GROUP,
				name,
				description: dto.description?.trim() || null,
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

		return await this.serializeChat(chat);
	}

	async listChats(dto: ListChatsDto) {
		const chats = await this.chatRepository.findMany({
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

		return Promise.all(chats.map((chat) => this.serializeChat(chat)));
	}

	async getChat(dto: ChatIdDto) {
		await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

		const chat = await this.chatRepository.findUnique({
			where: {
				id: dto.chatId,
			},
			include: getChatInclude(30),
		});

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
		const chat = await this.chatRepository.findUnique({
			where: {
				id: dto.chatId,
			},
			select: {
				type: true,
			},
		});

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

		const data: Prisma.ChatUpdateInput = {};
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
			await this.chatRepository.update({
				where: {
					id: dto.chatId,
				},
				data,
				include: getChatInclude(),
			}),
		);

		broadcastChatUpdated(dto.chatId, updated);
		return updated;
	}

	// Re-read + broadcast the chat after a membership change.
	private async broadcastChatState(chatId: string) {
		const chat = await this.chatRepository.findUnique({
			where: { id: chatId },
			include: getChatInclude(),
		});
		if (chat) {
			broadcastChatUpdated(chatId, await this.serializeChat(chat));
		}
	}

	async addParticipant(dto: ParticipantDto) {
		const chat = await this.chatRepository.findUnique({
			where: {
				id: dto.chatId,
			},
			select: {
				type: true,
			},
		});

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

		const participant = await this.chatRepository.upsertParticipant({
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

		// Pull the new member's sockets into the room so they receive the
		// chat:updated below and every message from here on.
		await addUserToChatRoom(dto.participantId, dto.chatId);
		await this.broadcastChatState(dto.chatId);

		return await this.serializeParticipant(participant);
	}

	async removeParticipant(dto: ParticipantDto) {
		const chat = await this.chatRepository.findUnique({
			where: {
				id: dto.chatId,
			},
			select: {
				type: true,
			},
		});

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

		const participant = await this.chatRepository.updateParticipant({
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
		
		await this.broadcastChatState(dto.chatId);

		return await this.serializeParticipant(participant);
	}

	async updateParticipantSettings(dto: UpdateChatParticipantDto) {
		await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

		const data: Prisma.ChatParticipantUpdateInput = {};
		if (dto.mutedUntil !== undefined) {
			data.mutedUntil = dto.mutedUntil ? new Date(dto.mutedUntil) : null;
		}
		if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
		if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

		const participant = await this.chatRepository.updateParticipant({
			where: {
				chatId_userId: {
					chatId: dto.chatId,
					userId: dto.currentUserId,
				},
			},
			data,
			include: participantInclude,
		});

		return await this.serializeParticipant(participant);
	}

	// "Delete for me": drop the caller from the chat by stamping their
	// participant row's `leftAt`. The conversation disappears from their list
	// (see `listChats`' `leftAt: null` filter) while everyone else keeps it.
	// Re-opening a direct chat with the same person clears `leftAt` again.
	async leaveChat(dto: ChatIdDto) {
		await this.requireActiveParticipant(dto.chatId, dto.currentUserId);

		await this.chatRepository.updateParticipant({
			where: {
				chatId_userId: {
					chatId: dto.chatId,
					userId: dto.currentUserId,
				},
			},
			data: {
				leftAt: new Date(),
			},
		});

		const chat = await this.chatRepository.findUnique({
			where: { id: dto.chatId },
			select: { type: true },
		});

		// Group members should see the roster change immediately; a direct
		// chat has nothing meaningful to broadcast.
		if (chat?.type === ChatType.GROUP) {
			await this.broadcastChatState(dto.chatId);
		}

		return { message: "Chat removed" };
	}

	async deleteChat(dto: ChatIdDto) {
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

		const chatDeleted = await this.chatRepository.delete({
			where: {
				id: dto.chatId,
			},
		});

		return await this.serializeChat(chatDeleted);
	}
}
