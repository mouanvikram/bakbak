import { FriendRequestStatus } from "@bakbak/db";
import type { FriendRepository } from "./repository";
import type { FriendRequestIdType, FriendRequestType } from "./types";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export class FriendService {
	constructor(private readonly friendRepository: FriendRepository) {}
	//requests
	async sendRequest(dto: FriendRequestType) {
		const { senderId, receiverId } = dto;

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

		return request;
	}

	async cancelRequest(dto: FriendRequestIdType) {
		const { id } = dto;

		const existing = await this.friendRepository.findRequestById(id);
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
				"Friend request not found",
			);
		}

		const request = await this.friendRepository.updateRequest(
			{
				id,
			},
			{
				status: FriendRequestStatus.CANCELLED,
			},
		);

		return request;
	}

	async acceptReqeust(dto: FriendRequestIdType) {
		const { id } = dto;

		const existing = await this.friendRepository.findRequestById(id);
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
				"Friend request not found",
			);
		}

		if (existing.status !== FriendRequestStatus.PENDING) {
			throw new AppError(
				HTTP_STATUS.CONFLICT,
				ERROR_CODES.CONFLICT,
				"Friend request is not pending",
			);
		}

		const [user1Id, user2Id] = [existing.senderId, existing.receiverId].sort();

		const alreadyFriends = await this.friendRepository.findFriendship({
			OR: [
				{ user1Id, user2Id },
				{ user1Id: user2Id, user2Id: user1Id },
			],
		});

		if (!alreadyFriends) {
			await this.friendRepository.createFriendship({
				user1: { connect: { id: user1Id } },
				user2: { connect: { id: user2Id } },
			});
		}

		const request = await this.friendRepository.updateRequest(
			{
				id,
			},
			{
				status: FriendRequestStatus.ACCEPTED,
			},
		);

		return request;
	}

	async rejectRequest(dto: FriendRequestIdType) {
		const { id } = dto;

		const existing = await this.friendRepository.findRequestById(id);
		if (!existing) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.FRIEND_REQUEST_NOT_FOUND,
				"Friend request not found",
			);
		}

		const request = await this.friendRepository.updateRequest(
			{
				id,
			},
			{
				status: FriendRequestStatus.REJECTED,
			},
		);

		return request;
	}

	//friends
	async getFriends(id: string) {
		const friendships = await this.friendRepository.findFriends({
			OR: [{ user1Id: id }, { user2Id: id }],
		});

		return friendships.map((friendship) => {
			const friend =
				friendship.user1Id === id ? friendship.user2 : friendship.user1;

			return {
				friendshipId: friendship.id,
				createdAt: friendship.createdAt,
				friend,
			};
		});
	}

  async removeFriend(id: string) {
    const existing = await this.friendRepository.findFriendship({ id });
    if (!existing) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.FRIENDSHIP_NOT_FOUND,
        "Friendship not found",
      );
    }

    await this.friendRepository.deleteFriendship({
      id,
    });
  }

	// Requests — outgoing = I sent, incoming = I received
	async getIncomingRequests(id: string) {
		const requests = await this.friendRepository.findRequest({
			receiverId: id,
			status: FriendRequestStatus.PENDING,
		});

		return requests;
	}

	async getOutgoingRequests(id: string) {
		const requests = await this.friendRepository.findRequest({
			senderId: id,
			status: FriendRequestStatus.PENDING,
		});

		return requests;
	}

	// Status
	async getRelationshipStatus(dto: { userId: string; otherUserId: string }) {
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
}
