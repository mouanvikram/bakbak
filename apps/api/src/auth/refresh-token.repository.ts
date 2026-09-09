import { prisma, Prisma } from "@bakbak/db";

export class RefreshTokenRepository {
  async create(data: Prisma.RefreshTokenUncheckedCreateInput) {
    return await prisma.refreshToken.create({ data });
  }

  async findFirst(where: Prisma.RefreshTokenWhereInput) {
    return await prisma.refreshToken.findFirst({ where });
  }

  async revoke(id: string) {
    return await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired() {
    return await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  async createSession(data: {
    userId: string;
    userAgent: string | null;
    expiresAt: Date;
  }) {
    return await prisma.session.create({ data });
  }

  async touchSession(id: string, expiresAt: Date) {
    return await prisma.session.update({
      where: { id },
      data: { expiresAt },
    });
  }

  async findSessionById(id: string) {
    return await prisma.session.findUnique({
      where: { id },
      select: { id: true, userId: true, revokedAt: true },
    });
  }

  async findActiveSessionsByUser(userId: string) {
    return await prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeSessionForUser(userId: string, sessionId: string) {
    const result = await prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count > 0) {
      await prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return result;
  }

  async revokeAllSessionsExceptForUser(userId: string, keepSessionId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, sessionId: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsForUser(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
