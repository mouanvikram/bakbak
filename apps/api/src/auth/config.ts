export const authConfig = {
	frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
	refreshTokenExpiryDays: 7,
	verificationTokenTtlMs: 1000 * 60 * 60,
	passwordResetTokenTtlMs: 60 * 60 * 1000,
	dummyPasswordHash:
		"$argon2id$v=19$m=65536,t=3,p=1$O33CfCzMnDsgKMk96pdnpiDwdAHBcp0kBtscfTiFe5E$RGazuyPBViMxQ/tuHPhhiz3lPxuoIf8FnCMGZDaDLlM",
	passwordHashing: {
		algorithm: "argon2id",
		timeCost: 3,
		memoryCost: 65536,
	} as const,
	twoFactor: {
		codeTtlMinutes: 10,
		challengeTtl: "10m" as const,
		maxAttempts: 10,
		lockoutMs: 4 * 60 * 60 * 1000,
	},
};
