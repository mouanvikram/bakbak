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

	// ─── Sessions (one row per login; RefreshTokens rotate underneath it) ───

	async createSession(data: {
		userId: string;
		userAgent: string | null;
		expiresAt: Date;
	}) {
		return await prisma.session.create({ data });
	}

	/** Push a session's expiry out on a successful refresh (rolling lifetime). */
	async touchSession(id: string, expiresAt: Date) {
		return await prisma.session.update({
			where: { id },
			data: { expiresAt },
		});
	}

	/** Live (unrevoked) sessions for a user, newest first — the Devices page. */
	async findActiveSessionsByUser(userId: string) {
		return await prisma.session.findMany({
			where: { userId, revokedAt: null },
			orderBy: { createdAt: "desc" },
		});
	}

	/** Revoke one session (scoped to its owner) and every token issued under it. */
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

	/**
	 * Revoke every live session (and its tokens) for a user, keeping one.
	 * A null `keepSessionId` (e.g. the caller's own token predates session
	 * tracking) revokes everything.
	 */
	async revokeAllSessionsExceptForUser(userId: string, keepSessionId: string | null) {
		await prisma.session.updateMany({
			where: {
				userId,
				revokedAt: null,
				...(keepSessionId ? { id: { not: keepSessionId } } : {}),
			},
			data: { revokedAt: new Date() },
		});

		await prisma.refreshToken.updateMany({
			where: {
				userId,
				revokedAt: null,
				...(keepSessionId ? { sessionId: { not: keepSessionId } } : {}),
			},
			data: { revokedAt: new Date() },
		});
	}

	/** Revoke every session (and its tokens) for a user — full logout. */
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
