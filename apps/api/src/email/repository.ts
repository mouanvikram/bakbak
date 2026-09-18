import { VerificationTokenType, prisma } from "@bakbak/db";

/** The fields a verification token is minted from. */
export interface NewVerificationToken {
  userId: string;
  tokenHash: string;
  type: VerificationTokenType;
  expiresAt: Date;
}

export class EmailRepository {
  constructor() {}

  async createToken(token: NewVerificationToken) {
    return await prisma.verificationToken.create({
      data: {
        tokenHash: token.tokenHash,
        type: token.type,
        expiresAt: token.expiresAt,
        user: { connect: { id: token.userId } },
      },
    });
  }

  /** An unexpired token of this type. Tokens are stored only as hashes, so the
   *  hash is the lookup key. */
  async findLiveToken(tokenHash: string, type: VerificationTokenType) {
    return await prisma.verificationToken.findFirst({
      where: { tokenHash, type, expiresAt: { gt: new Date() } },
    });
  }

  /** Same, scoped to one account: a 2FA code is only valid for the user it was
   *  issued to, so the lookup must not match another account's code. */
  async findLiveTokenForUser(
    userId: string,
    tokenHash: string,
    type: VerificationTokenType,
  ) {
    return await prisma.verificationToken.findFirst({
      where: { userId, tokenHash, type, expiresAt: { gt: new Date() } },
    });
  }

  async deleteAllOfType(userId: string, type: VerificationTokenType) {
    return await prisma.verificationToken.deleteMany({
      where: { userId, type },
    });
  }

  async deleteExpired() {
    return await prisma.verificationToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  // Marks the account verified and clears every pending email-verification
  // token in one transaction so a stale token can never be replayed.
  async markVerifiedAndClearTokens(userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isEmailVerified: true },
      });

      await tx.verificationToken.deleteMany({
        where: {
          userId,
          type: VerificationTokenType.EMAIL_VERIFICATION,
        },
      });
    });
  }

  // Applies the new password hash and consumes the reset token atomically.
  async resetPasswordAndClearToken(
    userId: string,
    passwordHash: string,
    tokenId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await tx.verificationToken.deleteMany({
        where: { id: tokenId },
      });
    });
  }
}
