import { prisma, Prisma } from "@sealchat/db";
class UserRepository {
  // will work every type id,email, username
  async findBy(where: Prisma.UserWhereUniqueInput) {
    return prisma.user.findUnique({
      where,
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
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

  async deleteBy(where: Prisma.UserWhereUniqueInput) {
    return prisma.user.delete({
      where,
    });
  }
}

export const userRepository = new UserRepository();
