import { Prisma, prisma } from "@sealchat/db";

export class EmailRepository {
  constructor() {}

  async create(data: Prisma.VerificationTokenCreateInput) {
    return await prisma.verificationToken.create({
      data,
    });
  }
  
  async findBy(where: Prisma.VerificationTokenWhereInput) {
    return await prisma.verificationToken.findFirst({ where });
  }

  async deleteAll(where: Prisma.VerificationTokenWhereInput) {
    return await prisma.verificationToken.deleteMany({
      where,
    });
  }
}
