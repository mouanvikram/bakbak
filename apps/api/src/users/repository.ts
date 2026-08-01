import { prisma, Prisma } from "@sealchat/db";
export class UserRepository {
  // will work every type id,email, username
  async findBy(where: Prisma.UserWhereUniqueInput) {
    return prisma.user.findUnique({
      where,
    });
  }
  async getProfile<T extends Prisma.UserFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>,
  ) {
    return prisma.user.findUnique({
      ...args,
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

  async search() {}

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
