import { str } from "@/config/parse";

export const systemConfig = {
	appVersion: str(process.env.APP_VERSION, "dev"),
	gitCommit: str(
		process.env.GIT_COMMIT,
		str(process.env.VERCEL_GIT_COMMIT_SHA, "unknown"),
	),
	buildTime: str(process.env.BUILD_TIME, new Date().toISOString()),
};
