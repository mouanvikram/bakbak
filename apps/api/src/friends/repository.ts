import { prisma, Prisma } from "@sealchat/db";

const friendUserSelect = {
  id: true,
  username: true,
  profile: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      avatar: true,
      bio: true,
    },
  },
} satisfies Prisma.UserSelect;

export class FriendRepository {
  // Friend Requests State
  async findRequest(where: Prisma.FriendRequestWhereInput) {
    return await prisma.friendRequest.findMany({
      where,
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findRequestById(id: string) {
    return await prisma.friendRequest.findUnique({
      where: { id },
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
    });
  }

  // requests
  async createRequest(data: Prisma.FriendRequestCreateInput) {
    return await prisma.friendRequest.create({
      data,
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
    });
  }

  async updateRequest(
    where: Prisma.FriendRequestWhereUniqueInput,
    data: Prisma.FriendRequestUpdateInput,
  ) {
    return await prisma.friendRequest.update({
      where,
      data,
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
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
      include: {
        user1: { select: friendUserSelect },
        user2: { select: friendUserSelect },
      },
      orderBy: { createdAt: "desc" },
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
      include: {
        user1: { select: friendUserSelect },
        user2: { select: friendUserSelect },
      },
    });
  }

  async deleteFriendship(where: Prisma.FriendshipWhereUniqueInput) {
    return await prisma.friendship.delete({
      where,
    });
  }
}
