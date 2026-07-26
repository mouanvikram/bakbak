import { prisma } from "@sealchat/db";

class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: {
        username,
      },
    });
  }
  async findById(id: string) {
    return prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }) {
    return prisma.user.create({
      data,
    });
  }

  async updateById(
    id: string,
    data: Partial<{
      email: string;
      username: string;
      isEmailVerified: boolean;
      passwordHash: string;
    }>,
  ) {
    return prisma.user.update({
      where: {
        id,
      },
      data,
    });
  }
  async updateByEmail(
    email: string,
    data: Partial<{
      email: string;
      username: string;
      isEmailVerified: boolean;
      passwordHash: string;
    }>,
  ) {
    return prisma.user.update({
      where: {
        email,
      },
      data,
    });
  }
  
  async deleteById(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async deleteByEmail(email: string) {
    return prisma.user.delete({
      where: { email },
    });
  }

  async deleteByUsername(username: string) {
    return prisma.user.delete({
      where: { username },
    });
  }
}

export default UserRepository;
