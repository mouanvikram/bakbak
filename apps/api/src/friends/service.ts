import {
	FriendRequestStatus,
	Prisma,
	type Friendship,
	type FriendRequest,
} from "@bakbak/db";
import type { FriendRepository } from "./repository";
import type {
	AcceptFriendRequestResponseType,
	CancelFriendRequestResponseType,
	FriendRequestIdType,
	FriendRequestResponseType,
	FriendRequestType,
	GetFriendsResponseType,
	GetSuggestionsResponseType,
	RejectFriendRequestResponseType,
	RemoveFriendResponseType,
	SendFriendRequestResponseType,
	UserIdType,
} from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { StorageProvider } from "../uploads/storage.provider";
import { resolveAvatarUrl } from "../uploads/avatar-url";

export class FriendService {
	constructor(
		private readonly friendRepository: FriendRepository,
		private readonly storageProvider: StorageProvider,
	) {}

	private serializeDateFields<T extends { createdAt: Date; updatedAt: Date }>(
		record: T,
	) {
		return {
			...record,
			createdAt: record.createdAt.toISOString(),
			updatedAt: record.updatedAt.toISOString(),
		};
	}

	private async serializeRequest<
		T extends FriendRequest &
			{
				createdAt: Date;
				updatedAt: Date;
				sender?: { profile?: { avatar?: string | null } | null };
				receiver?: { profile?: { avatar?: string | null } | null };
			},
	>(request: T) {
		const serialized = this.serializeDateFields(request);
		if (serialized.sender?.profile?.avatar !== undefined) {
			serialized.sender.profile.avatar = await resolveAvatarUrl(
				serialized.sender.profile.avatar,
				this.storageProvider,
			);
		}
		if (serialized.receiver?.profile?.avatar !== undefined) {
			serialized.receiver.profile.avatar = await resolveAvatarUrl(
				serialized.receiver.profile.avatar,
				this.storageProvider,
			);
		}
		return serialized;
	}

	async sendRequest(
		dto: FriendRequestType,
	): Promise<SendFriendRequestResponseType> {
		const { senderId, receiverId } = dto;

		if (senderId === receiverId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"You cannot send a friend request to yourself",
			);
		}

		const reverseRequest = await this.friendRepository.findRequest({
			senderId: receiverId,
			receiverId: senderId,
			status: FriendRequestStatus.PENDING,
		});

		if (reverseRequest.length > 0) {
			throw new AppError(
				HTTP_STATUS.CONFLICT,
				ERROR_CODES.CONFLICT,
				"This user has already sent you a friend request",
			);
		}

		try {
			const request = await this.friendRepository.createRequest({
				sender: {
					connect: {
						id: senderId,
					},
				},
				receiver: {
					connect: {
						id: receiverId,
					},
				},
			});

			return await this.serializeRequest(request);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new AppError(
					HTTP_STATUS.CONFLICT,
					ERROR_CODES.CONFLICT,
					"A friend request already exists between these users",
				);
			}

			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				(error.code === "P2025" || error.code === "P2003")
			) {
				throw new AppError(
					HTTP_STATUS.NOT_FOUND,
					ERROR_CODES.USER_NOT_FOUND,
					"Receiver user not found",
				);
			}

			throw error;
		}
	}

	async cancelRequest(
		dto: FriendRequestIdType & UserIdType,
	): Promise<CancelFriendRequestResponseType> {
		const { requestId, userId } = dto;

		const existing = await this.friendRepository.findRequestById(requestId);
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
				"Friend request not found",
			);
		}

		if (existing.senderId !== userId) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.FORBIDDEN,
				"Only the sender can cancel a friend request",
			);
		}

		if (existing.status !== FriendRequestStatus.PENDING) {
			throw new AppError(
				HTTP_STATUS.CONFLICT,
				ERROR_CODES.CONFLICT,
				"Only pending friend requests can be cancelled",
			);
		}

		const request = await this.friendRepository.updateRequest(
			{
				id: requestId,
			},
			{
				status: FriendRequestStatus.CANCELLED,
			},
		);

		return await this.serializeRequest(request);
	}

	async acceptRequest(
		dto: FriendRequestIdType & UserIdType,
	): Promise<AcceptFriendRequestResponseType> {
		const { requestId, userId } = dto;

		const existing = await this.friendRepository.findRequestById(requestId);
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
				"Friend request not found",
			);
		}

		if (existing.receiverId !== userId) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.FORBIDDEN,
				"Only the receiver can accept a friend request",
			);
		}

		if (existing.status !== FriendRequestStatus.PENDING) {
			throw new AppError(
				HTTP_STATUS.CONFLICT,
				ERROR_CODES.CONFLICT,
				"Friend request is not pending",
			);
		}

		const request = await this.friendRepository.acceptPendingRequest(requestId);
		if (!request) {
			throw new AppError(
				HTTP_STATUS.CONFLICT,
				ERROR_CODES.CONFLICT,
				"Friend request is not pending",
			);
		}

		return await this.serializeRequest(request);
	}

	async rejectRequest(
		dto: FriendRequestIdType & UserIdType,
	): Promise<RejectFriendRequestResponseType> {
		const { requestId, userId } = dto;

		const existing = await this.friendRepository.findRequestById(requestId);
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
				"Friend request not found",
			);
		}

		if (existing.receiverId !== userId) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.FORBIDDEN,
				"Only the receiver can reject a friend request",
			);
		}

		if (existing.status !== FriendRequestStatus.PENDING) {
			throw new AppError(
				HTTP_STATUS.CONFLICT,
				ERROR_CODES.CONFLICT,
				"Only pending friend requests can be rejected",
			);
		}

		const request = await this.friendRepository.updateRequest(
			{
				id: requestId,
			},
			{
				status: FriendRequestStatus.REJECTED,
			},
		);

		return await this.serializeRequest(request);
	}

	async getFriends(
		dto: UserIdType,
	): Promise<GetFriendsResponseType["friendships"]> {
		const friendships = await this.friendRepository.findFriends({
			OR: [{ user1Id: dto.userId }, { user2Id: dto.userId }],
		});

		return Promise.all(
			friendships.map(async (friendship) => {
				const friend =
					friendship.user1Id === dto.userId
						? friendship.user2
						: friendship.user1;

				return {
					friendshipId: friendship.id,
					createdAt: friendship.createdAt.toISOString(),
					friend: {
						...friend,
						profile: friend.profile
							? {
									...friend.profile,
									avatar: await resolveAvatarUrl(
										friend.profile.avatar,
										this.storageProvider,
									),
								}
							: friend.profile,
					},
				};
			}),
		);
	}

	async removeFriend(
		dto: FriendRequestIdType & UserIdType,
	): Promise<RemoveFriendResponseType> {
		const { requestId, userId } = dto;

		const existing = await this.friendRepository.findFriendship({
			id: requestId,
		});
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIENDSHIP_NOT_FOUND,
				"Friendship not found",
			);
		}

		if (existing.user1Id !== userId && existing.user2Id !== userId) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.FORBIDDEN,
				"You are not a participant of this friendship",
			);
		}

		await this.friendRepository.deleteFriendship({
			id: requestId,
		});

		return {
			message: "Friend removed successfully",
		};
	}

	// Requests — outgoing = I sent, incoming = I received
	async getIncomingRequests(id: string): Promise<FriendRequestResponseType[]> {
		const requests = await this.friendRepository.findRequest({
			receiverId: id,
			status: FriendRequestStatus.PENDING,
		});

		return Promise.all(
			requests.map((request) => this.serializeRequest(request)),
		);
	}

	async getOutgoingRequests(id: string): Promise<FriendRequestResponseType[]> {
		const requests = await this.friendRepository.findRequest({
			senderId: id,
			status: FriendRequestStatus.PENDING,
		});

		return Promise.all(
			requests.map((request) => this.serializeRequest(request)),
		);
	}

	async getRelationshipStatus(dto: {
		userId: string;
		otherUserId: string;
	}): Promise<Friendship | null> {
		const status = await this.friendRepository.findFriendship({
			OR: [
				{
					user1Id: dto.userId,
					user2Id: dto.otherUserId,
				},
				{
					user1Id: dto.otherUserId,
					user2Id: dto.userId,
				},
			],
		});
		return status;
	}

	async getSuggestions(dto: UserIdType): Promise<GetSuggestionsResponseType> {
		const suggestions = await this.friendRepository.findSuggestions(dto.userId);

		const resolved = await Promise.all(
			suggestions.map(async (user) => ({
				...user,
				profile: user.profile
					? {
							...user.profile,
							avatar: await resolveAvatarUrl(
								user.profile.avatar,
								this.storageProvider,
							),
						}
					: user.profile,
			})),
		);

		return { suggestions: resolved };
	}
}
