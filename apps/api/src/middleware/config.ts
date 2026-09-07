// Middleware config — global rate-limit window and the query params the
// request logger redacts from every logged URL.
export const middlewareConfig = {
	rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
	rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
	sensitiveQueryParams: ["token", "code"],
};
