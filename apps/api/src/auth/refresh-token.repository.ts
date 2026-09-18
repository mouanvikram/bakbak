import { prisma } from "@bakbak/db";

/** The fields a refresh token is issued from. */
export interface NewRefreshToken {
  tokenHash: string;
  expiresAt: Date;
  userId: string;
  sessionId: string;
}

export class RefreshTokenRepository {
  async createToken(token: NewRefreshToken) {
    return await prisma.refreshToken.create({ data: token });
  }

  /** Tokens are stored only as hashes, so this is the only way to find one. */
  async findByTokenHash(tokenHash: string) {
    return await prisma.refreshToken.findFirst({ where: { tokenHash } });
  }

  // Conditional flip: only one concurrent caller can move revokedAt off null,
  // so two requests racing the same refresh token can't both rotate it.
  async revokeIfActive(id: string): Promise<boolean> {
    const result = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
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
