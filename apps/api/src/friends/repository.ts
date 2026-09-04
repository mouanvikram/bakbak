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

export class FriendRepository {
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

	async deleteRequest(where: Prisma.FriendRequestWhereUniqueInput) {
		return await prisma.friendRequest.delete({
			where,
		});
	}

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

	async findSuggestions(currentUserId: string) {
		const friendships = await prisma.friendship.findMany({
			where: {
				OR: [
					{ user1Id: currentUserId },
					{ user2Id: currentUserId },
				],
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
				id: { notIn: Array.from(excludeIds) },
			},
			select: friendUserSelect,
			take: 20,
			orderBy: { createdAt: "desc" },
		});
	}
}
