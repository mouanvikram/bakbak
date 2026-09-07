// Users module config — brute-force policy for password login. Consumed by
// UserRepository.recordFailedLogin (single-statement increment + lock).
export const usersConfig = {
	loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
	loginLockoutMs: Number(process.env.LOGIN_LOCKOUT_MS) || 15 * 60 * 1000,
};
