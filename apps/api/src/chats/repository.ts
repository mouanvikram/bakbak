import { Prisma, prisma } from "@bakbak/db";

export class ChatRepository {
  async create<T extends Prisma.ChatCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatCreateArgs>,
  ) {
    return await prisma.chat.create(args);
  }

  async upsert<T extends Prisma.ChatUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatUpsertArgs>,
  ) {
    return await prisma.chat.upsert(args);
  }

  async update<T extends Prisma.ChatUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatUpdateArgs>,
  ) {
    return await prisma.chat.update(args);
  }

  async delete<T extends Prisma.ChatDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatDeleteArgs>,
  ) {
    return await prisma.chat.delete(args);
  }

  async findUnique<T extends Prisma.ChatFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatFindUniqueArgs>,
  ) {
    return await prisma.chat.findUnique(args);
  }

  async findFirst<T extends Prisma.ChatFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatFindFirstArgs>,
  ) {
    return await prisma.chat.findFirst(args);
  }

  async findMany<T extends Prisma.ChatFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ChatFindManyArgs>,
  ) {
    return await prisma.chat.findMany(args);
  }

  async findParticipant<T extends Prisma.ChatParticipantFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatParticipantFindFirstArgs>,
  ) {
    return await prisma.chatParticipant.findFirst(args);
  }

  async createParticipant<T extends Prisma.ChatParticipantCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatParticipantCreateArgs>,
  ) {
    return await prisma.chatParticipant.create(args);
  }

  async updateParticipant<T extends Prisma.ChatParticipantUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatParticipantUpdateArgs>,
  ) {
    return await prisma.chatParticipant.update(args);
  }

  async upsertParticipant<T extends Prisma.ChatParticipantUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChatParticipantUpsertArgs>,
  ) {
    return await prisma.chatParticipant.upsert(args);
  }
}
