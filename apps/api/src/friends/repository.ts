import { prisma, Prisma, FriendRequestStatus } from "@bakbak/db";

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

const requestInclude = {
  sender: { select: friendUserSelect },
  receiver: { select: friendUserSelect },
} satisfies Prisma.FriendRequestInclude;

export class FriendRepository {
  /** Pending requests this user has sent to that one. */
  async findPendingBetween(senderId: string, receiverId: string) {
    return await prisma.friendRequest.findMany({
      where: { senderId, receiverId, status: FriendRequestStatus.PENDING },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Pending requests waiting for this user to answer. */
  async findPendingForReceiver(receiverId: string) {
    return await prisma.friendRequest.findMany({
      where: { receiverId, status: FriendRequestStatus.PENDING },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Pending requests this user has sent and not yet had answered. */
  async findPendingForSender(senderId: string) {
    return await prisma.friendRequest.findMany({
      where: { senderId, status: FriendRequestStatus.PENDING },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /** The most recent request between two users, in either direction
   * (there are at most two rows thanks to the unique constraint). */
  async findLatestRequestBetween(a: string, b: string) {
    return await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
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

  async createRequest(senderId: string, receiverId: string) {
    return await prisma.friendRequest.create({
      data: {
        sender: { connect: { id: senderId } },
        receiver: { connect: { id: receiverId } },
      },
      include: requestInclude,
    });
  }

  /** Cancel / reject: status is the only field a request ever updates. */
  async setRequestStatus(id: string, status: FriendRequestStatus) {
    return await prisma.friendRequest.update({
      where: { id },
      data: { status },
      include: requestInclude,
    });
  }

  // Accepts a pending request and creates the friendship in one transaction.
  // Returns null if the request no longer exists or is no longer PENDING.
  async acceptPendingRequest(id: string) {
    return await prisma.$transaction(async (tx) => {
      const request = await tx.friendRequest.findUnique({
        where: { id },
      });

      if (!request || request.status !== FriendRequestStatus.PENDING) {
        return null;
      }

      const [firstId, secondId] = [request.senderId, request.receiverId];
      const [user1Id, user2Id] =
        firstId <= secondId ? [firstId, secondId] : [secondId, firstId];

      const existingFriendship = await tx.friendship.findFirst({
        where: {
          OR: [
            { user1Id, user2Id },
            { user1Id: user2Id, user2Id: user1Id },
          ],
        },
      });

      if (!existingFriendship) {
        await tx.friendship.create({
          data: { user1Id, user2Id },
        });
      }

      return await tx.friendRequest.update({
        where: { id },
        data: { status: FriendRequestStatus.ACCEPTED },
        include: {
          sender: { select: friendUserSelect },
          receiver: { select: friendUserSelect },
        },
      });
    });
  }

  /** Everyone this user is friends with. */
  async findFriendshipsOf(userId: string) {
    return await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        // A soft-deleted account (or one already anonymized past its recovery
        // window) is not a friend — keep them out of the friends list.
        user1: { deletedAt: null },
        user2: { deletedAt: null },
      },
      include: {
        user1: { select: friendUserSelect },
        user2: { select: friendUserSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Ids of everyone `userId` is friends with (deleted accounts included). */
  async findFriendIds(userId: string): Promise<string[]> {
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      select: { user1Id: true, user2Id: true },
    });
    return rows.map((row) =>
      row.user1Id === userId ? row.user2Id : row.user1Id,
    );
  }

  async findFriendshipById(id: string) {
    return await prisma.friendship.findUnique({ where: { id } });
  }

  /** The friendship between two people, whichever column order it's stored in
   *  (pairs are normalised on write, but callers shouldn't have to know). */
  async findFriendshipBetween(userId: string, otherUserId: string) {
    return await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: userId },
        ],
      },
    });
  }

  async deleteFriendshipById(id: string) {
    return await prisma.friendship.delete({ where: { id } });
  }

  async findSuggestions(currentUserId: string) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      select: { user1Id: true, user2Id: true },
    });

    const requests = await prisma.friendRequest.findMany({
      where: {
        OR: [
          { senderId: currentUserId, status: "PENDING" },
          { receiverId: currentUserId, status: "PENDING" },
        ],
      },
      select: { senderId: true, receiverId: true },
    });

    const excludeIds = new Set<string>([
      currentUserId,
      ...friendships.map((f) =>
        f.user1Id === currentUserId ? f.user2Id : f.user1Id,
      ),
      ...requests.map((r) =>
        r.senderId === currentUserId ? r.receiverId : r.senderId,
      ),
    ]);

    return await prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { notIn: Array.from(excludeIds) },
      },
      select: friendUserSelect,
      take: 20,
      orderBy: { createdAt: "desc" },
    });
  }
}
