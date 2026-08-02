import { FriendRequestStatus } from "@sealchat/db";
import type { FriendRepository } from "./repository";
import type { FriendRequestIdType, FriendRequestType } from "./types";

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
    const friends = await this.friendRepository.findFriends({ id });

    return friends;
  }

  async removeFriend(id: string) {
    const friend = await this.friendRepository.deleteFriendship({
      id,
    });
  }

  // Requests
  async getIncomingRequests(id: string) {
    const requests = await this.friendRepository.findRequest({
      senderId: id,
    });

    return requests;
  }

  async getOutgoingRequests(id: string) {
    const requests = await this.friendRepository.findRequest({
      receiverId: id,
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
    return status
  }
}
