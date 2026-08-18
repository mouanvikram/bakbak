export interface RefreshTokenRecord {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: Date;
	createdAt: Date;
}

export interface RefreshTokenRepository {
	create(data: {
		userId: string;
		tokenHash: string;
		expiresAt: Date;
	}): Promise<RefreshTokenRecord>;

	findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

	deleteByTokenHash(tokenHash: string): Promise<void>;

	// Used for "log out of all devices" / invalidating everything on
	// password change, not currently wired up but useful to have.
	deleteAllForUser(userId: string): Promise<void>;
}
