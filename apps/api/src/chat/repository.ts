import { Prisma, prisma } from "@sealchat/db";

export class ChatRepository {
  async create(data: Prisma.ChatCreateInput) {
    return await prisma.chat.create({
      data,
    });
  }

  async update(
    where: Prisma.ChatWhereUniqueInput,
    data: Prisma.ChatUpdateInput,
  ) {
    return await prisma.chat.update({
      where,
      data,
    });
  }

  async delete(id: string) {
    return await prisma.chat.delete({
      where: {
        id,
      },
    });
  }

  async findMany(args?: Prisma.ChatFindManyArgs) {
    return prisma.chat.findMany(args);
  }
  // async
}
