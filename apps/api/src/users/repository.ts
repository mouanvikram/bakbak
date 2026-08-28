import { prisma, Prisma } from "@bakbak/db";
export class UserRepository {
	// will work every type id,email, username
	async findBy(where: Prisma.UserWhereUniqueInput) {
		return prisma.user.findUnique({
			where,
		});
	}

	async findFirst(where: Prisma.UserWhereInput) {
		return prisma.user.findFirst({
			where,
			include: {
				profile: true,
			},
		});
	}

	async getProfile<T extends Prisma.UserFindUniqueArgs>(
		args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>,
	) {
		return prisma.user.findUnique({
			...args,
		});
	}

	async countFriends(userId: string) {
		const [asUser1, asUser2] = await Promise.all([
			prisma.friendship.count({ where: { user1Id: userId } }),
			prisma.friendship.count({ where: { user2Id: userId } }),
		]);
		return asUser1 + asUser2;
	}

	async getUsers(query: string) {
		return prisma.user.findMany({
			where: query
				? {
						OR: [
							{
								username: {
									contains: query,
									mode: "insensitive",
								},
							},
							{
								profile: {
									firstName: {
										contains: query,
										mode: "insensitive",
									},
								},
							},
							{
								profile: {
									lastName: {
										contains: query,
										mode: "insensitive",
									},
								},
							},
						],
					}
				: undefined,
			select: {
				id: true,
				username: true,
				profile: {
					select: {
						firstName: true,
						lastName: true,
						bio: true,
						displayName: true,
						avatar: true,
					},
				},
			},
			take: 20,
		});
	}

	async create(data: Prisma.UserCreateInput) {
		return prisma.user.create({
			data,
			include: {
				profile: true,
			},
		});
	}

	async updateBy(
		where: Prisma.UserWhereUniqueInput,
		data: Prisma.UserUpdateInput,
	) {
		return prisma.user.update({
			where,
			data,
		});
	}

	async updateProfile<T extends Prisma.UserUpdateArgs>(
		args: Prisma.SelectSubset<T, Prisma.UserUpdateArgs>,
	) {
		return prisma.user.update(args);
	}

	async deleteBy(where: Prisma.UserWhereUniqueInput) {
		return prisma.user.delete({
			where,
		});
	}
}
