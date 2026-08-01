import { prisma, Prisma } from "@sealchat/db";
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
        username: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            bio: true,
            displayName: true,
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
