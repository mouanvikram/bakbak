import { prisma, Prisma } from "@bakbak/db";
import { usersConfig } from "./config";
export class UserRepository {
  async findBy(where: Prisma.UserWhereUniqueInput) {
    return prisma.user.findUnique({
      where,
    });
  }

  async findActiveById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
      },
    });
  }

  async findActiveByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
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
      where: {
        deletedAt: null,
        ...(query
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
          : {}),
      },
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

  // Single-statement increment + conditional lock: the counter bump and
  // the lockout decision happen under one row lock, so a burst of
  // concurrent wrong passwords can't slip between a separate read/check
  // and lock write. Tagged-template params are bound, not interpolated.
  async recordFailedLogin(userId: string) {
    const lockUntil = new Date(Date.now() + usersConfig.loginLockoutMs);
    const rows = await prisma.$queryRaw<
      { failedLoginAttempts: number; lockedUntil: Date | null }[]
    >`
			UPDATE "User" SET
				"failedLoginAttempts" = "failedLoginAttempts" + 1,
				"lockedUntil" = CASE
					WHEN "failedLoginAttempts" + 1 >= ${usersConfig.loginMaxAttempts}
						AND ("lockedUntil" IS NULL OR "lockedUntil" <= NOW())
					THEN ${lockUntil}
					ELSE "lockedUntil" END,
				"updatedAt" = NOW()
			WHERE "id" = ${userId}::uuid
			RETURNING "failedLoginAttempts", "lockedUntil"
		`;
    return rows[0];
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

  // Same single-statement pattern as login: bump + conditional lock in
  // one UPDATE so concurrent wrong codes can't race the threshold check.
  async recordFailedTwoFactor(
    userId: string,
    maxAttempts: number,
    lockoutMs: number,
  ) {
    const lockUntil = new Date(Date.now() + lockoutMs);
    const rows = await prisma.$queryRaw<
      {
        twoFactorFailedAttempts: number;
        twoFactorLockedUntil: Date | null;
      }[]
    >`
			UPDATE "User" SET
				"twoFactorFailedAttempts" = "twoFactorFailedAttempts" + 1,
				"twoFactorLockedUntil" = CASE
					WHEN "twoFactorFailedAttempts" + 1 >= ${maxAttempts}
						AND ("twoFactorLockedUntil" IS NULL OR "twoFactorLockedUntil" <= NOW())
					THEN ${lockUntil}
					ELSE "twoFactorLockedUntil" END,
				"updatedAt" = NOW()
			WHERE "id" = ${userId}::uuid
			RETURNING "twoFactorFailedAttempts", "twoFactorLockedUntil"
		`;
    return rows[0];
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

  /** Marks the account deleted without removing the row — nothing about the
   * user, or the messages they sent, is actually erased. */
  async markDeleted(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Clears the soft-delete flag, bringing the account back within the
   * recovery window. The row was never removed, so everything is intact. */
  async restoreDeleted(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Accounts soft-deleted long enough ago that their recovery window has  lapsed and they are not yet anonymized. 
  async findDeletedSince(cutoff: Date) {
    return prisma.user.findMany({
      where: {
        deletedAt: { lt: cutoff },
        anonymizedAt: null,
      },
      select: { id: true },
    });
  }

  // Scrubs a user whose recovery window has lapsed
  async anonymizeAccount(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.verificationToken.deleteMany({ where: { userId: id } });

      return tx.user.update({
        where: { id },
        data: {
          email: `deleted+${id}@bakbak.invalid`,
          username: `deleted_${id}`,
          passwordHash: "!anonymized!",
          isEmailVerified: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          twoFactorFailedAttempts: 0,
          twoFactorLockedUntil: null,
          anonymizedAt: new Date(),
          profile: {
            update: {
              data: {
                displayName: null,
                firstName: null,
                lastName: null,
                avatar: null,
                bio: null,
                dob: null,
                isOnline: false,
                lastSeenAt: null,
              },
            },
          },
        },
      });
    });
  }
}
