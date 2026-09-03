import { Prisma, VerificationTokenType, prisma } from "@bakbak/db";

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
