export const redisConfig = {
	host: process.env.REDIS_HOST ?? "localhost",
	port: process.env.REDIS_PORT ?? "6379",
	rateLimit: {
		global: {
			capacity: Number(process.env.RATE_LIMIT_GLOBAL_CAPACITY) || 200,
			refillRate: Number(process.env.RATE_LIMIT_GLOBAL_REFILL_PER_SEC) || 4,
		},

		login: {
			capacity: Number(process.env.RATE_LIMIT_LOGIN_CAPACITY) || 20,
			refillRate: Number(process.env.RATE_LIMIT_LOGIN_REFILL_PER_SEC) || 1 / 3,
		},

		email: {
			capacity: Number(process.env.RATE_LIMIT_EMAIL_CAPACITY) || 8,
			refillRate:
				Number(process.env.RATE_LIMIT_EMAIL_REFILL_PER_SEC) || 1 / 120,
		},

		uploads: {
			capacity: Number(process.env.RATE_LIMIT_UPLOADS_CAPACITY) || 20,
			refillRate:
				Number(process.env.RATE_LIMIT_UPLOADS_REFILL_PER_SEC) || 1 / 3,
		},

		messageSend: {
			capacity: Number(process.env.RATE_LIMIT_MESSAGE_SEND_CAPACITY) || 60,
			refillRate:
				Number(process.env.RATE_LIMIT_MESSAGE_SEND_REFILL_PER_SEC) || 2,
		},

		usernameCheck: {
			capacity: Number(process.env.RATE_LIMIT_USERNAME_CHECK_CAPACITY) || 20,
			refillRate:
				Number(process.env.RATE_LIMIT_USERNAME_CHECK_REFILL_PER_SEC) || 1,
		},

		// Friend-request sends (per sender) — bulk-add friend spam is the
		// classic abuse here. A handful a minute is plenty for a human.
		friendRequest: {
			capacity:
				Number(process.env.RATE_LIMIT_FRIEND_REQUEST_CAPACITY) || 20,
			refillRate:
				Number(process.env.RATE_LIMIT_FRIEND_REQUEST_REFILL_PER_SEC) ||
				1 / 20,
		},

		// Chat creation + adding members (per owner) — covers invite floods
		// and group-spam without touching message traffic.
		chat: {
			capacity: Number(process.env.RATE_LIMIT_CHAT_CAPACITY) || 25,
			refillRate: Number(process.env.RATE_LIMIT_CHAT_REFILL_PER_SEC) || 1 / 8,
		},
	},
};

export type RateLimitBucketName = keyof typeof redisConfig.rateLimit;
