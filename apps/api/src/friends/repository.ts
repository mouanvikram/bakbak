import { prisma, Prisma } from "@sealchat/db";

export class FriendRepository {
  // Friend Requests State
  async findRequest(where: Prisma.FriendRequestWhereInput) {
    return await prisma.friendRequest.findMany({ where });
  }

  // requests
  async createRequest(data: Prisma.FriendRequestCreateInput) {
    return await prisma.friendRequest.create({
      data,
    });
  }

  async updateRequest(
    where: Prisma.FriendRequestWhereUniqueInput,
    data: Prisma.FriendRequestUpdateInput,
  ) {
    return await prisma.friendRequest.update({
      where,
      data,
    });
  }

  async deleteRequest(where: Prisma.FriendRequestWhereUniqueInput) {
    return await prisma.friendRequest.delete({
      where,
    });
  }

  // friendships
  async findFriends(where: Prisma.FriendshipWhereInput) {
    return await prisma.friendship.findMany({
      where,
    });
  }

  async findFriendship(where: Prisma.FriendshipWhereInput) {
    return await prisma.friendship.findFirst({
      where,
    });
  }

  async createFriendship(data: Prisma.FriendshipCreateInput) {
    return await prisma.friendship.create({
      data,
    });
  }

  async deleteFriendship(where: Prisma.FriendshipWhereUniqueInput) {
    return await prisma.friendship.delete({
      where,
    });
  }
}
