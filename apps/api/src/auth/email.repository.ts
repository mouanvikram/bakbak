import { Prisma, prisma } from "@sealchat/db";

export class EmailRepository {
  constructor() {}

  async findBy(where: Prisma.EmailVerificationWhereInput) {
    return await prisma.emailVerification.findFirst({ where });
  }

  async deleteAll(where: Prisma.EmailVerificationWhereInput) {
    return await prisma.emailVerification.deleteMany({
      where,
    });
  }
}
