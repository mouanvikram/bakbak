import { prisma, Prisma } from "@bakbak/db";

export class RefreshTokenRepository {
	async create(data: Prisma.RefreshTokenCreateInput) {
		return await prisma.refreshToken.create({ data });
	}

	async findFirst(where: Prisma.RefreshTokenWhereInput) {
		return await prisma.refreshToken.findFirst({ where });
	}

	/** Live (unrevoked, unexpired) sessions for a user, newest first. */
	async findActiveByUser(userId: string) {
		return await prisma.refreshToken.findMany({
			where: {
				userId,
				revokedAt: null,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: "desc" },
		});
	}

	async revoke(id: string) {
		return await prisma.refreshToken.update({
			where: { id },
			data: { revokedAt: new Date() },
		});
	}

	// Revoke a whole login session: every rotated token sharing `sessionId`
	// (or a lone legacy row by `id`), scoped to `userId`.
	async revokeSessionForUser(userId: string, sessionKey: string) {
		return await prisma.refreshToken.updateMany({
			where: {
				userId,
				revokedAt: null,
				OR: [{ sessionId: sessionKey }, { id: sessionKey }],
			},
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

	/** Revoke every live session except the one identified by `keepSessionId`.
	 * A null keep revokes everything. */
	async revokeAllExceptSession(userId: string, keepSessionId: string | null) {
		return await prisma.refreshToken.updateMany({
			where: {
				userId,
				revokedAt: null,
				...(keepSessionId ? { sessionId: { not: keepSessionId } } : {}),
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
