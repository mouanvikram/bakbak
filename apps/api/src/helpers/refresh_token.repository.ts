import { prisma, Prisma } from "@bakbak/db";

export class RefreshTokenRepository {
	async create(data: Prisma.RefreshTokenCreateInput) {
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

	async revokeAll(userId: string) {
		return await prisma.refreshToken.updateMany({
			where: {
				userId,
				revokedAt: null,
			},
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
}
