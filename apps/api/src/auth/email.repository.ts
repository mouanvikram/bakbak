import { Prisma, prisma } from "@sealchat/db";

export class EmailRepository {
  constructor() {}

  async create(data: Prisma.EmailVerificationCreateInput) {
    return await prisma.emailVerification.create({
      data,
    });
  }
  async findBy(where: Prisma.EmailVerificationWhereInput) {
    return await prisma.emailVerification.findFirst({ where });
  }

  async deleteAll(where: Prisma.EmailVerificationWhereInput) {
    return await prisma.emailVerification.deleteMany({
      where,
    });
  }
}
