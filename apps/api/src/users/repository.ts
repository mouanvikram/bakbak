import { prisma, Prisma } from "@bakbak/db";
import { env } from "@/config";
export class UserRepository {
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
				settings: true,
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

	async recordFailedLogin(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: { failedLoginAttempts: { increment: 1 } },
		});
	}

	async lockLoginFor(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: {
				failedLoginAttempts: 0,
				lockedUntil: new Date(Date.now() + env.LOGIN_LOCKOUT_MS),
			},
		});
	}

	async resetLoginFailures(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: {
				failedLoginAttempts: 0,
				lockedUntil: null,
			},
		});
	}

	/** Atomically bumps the counter and returns the new value, so concurrent
	 * wrong-code requests each see their own accurate post-increment count
	 * instead of racing on a stale read. */
	async recordFailedTwoFactor(userId: string): Promise<number> {
		const updated = await prisma.user.update({
			where: { id: userId },
			data: { twoFactorFailedAttempts: { increment: 1 } },
			select: { twoFactorFailedAttempts: true },
		});
		return updated.twoFactorFailedAttempts;
	}

	async lockTwoFactorFor(userId: string, ms: number) {
		return prisma.user.update({
			where: { id: userId },
			data: {
				twoFactorFailedAttempts: 0,
				twoFactorLockedUntil: new Date(Date.now() + ms),
			},
		});
	}

	async resetTwoFactorFailures(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: {
				twoFactorFailedAttempts: 0,
				twoFactorLockedUntil: null,
			},
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

	async deleteSentMessages(userId: string) {
		return prisma.message.deleteMany({
			where: { senderId: userId },
		});
	}

	async getSentMessageFilePaths(userId: string) {
		const messages = await prisma.message.findMany({
			where: { senderId: userId },
			select: {
				attachments: {
					select: { filePath: true },
				},
			},
		});

		return messages.flatMap((message) =>
			message.attachments.map((attachment) => attachment.filePath),
		);
	}
}
