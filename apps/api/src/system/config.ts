// System module config — build/version info served at GET /api/v1/version
// so the client can spot a stale bundle. Stamped by CI; dev defaults below.
export const systemConfig = {
	appVersion: process.env.APP_VERSION?.trim() || "dev",
	gitCommit:
		process.env.GIT_COMMIT?.trim() ||
		process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
		"unknown",
	buildTime: process.env.BUILD_TIME?.trim() || new Date().toISOString(),
};
