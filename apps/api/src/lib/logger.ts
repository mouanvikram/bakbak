import pino from "pino";
import { env } from "@/config";
import { systemConfig } from "@/system/config";

const logger = pino({
	// Overridable without a redeploy; defaults are per-environment.
	level:
		process.env.LOG_LEVEL ??
		(env.NODE_ENV === "production" ? "info" : "debug"),

	// `pid`/`hostname` alone are useless in a container (pid 1, random host id).
	base: {
		service: "bakbak-api",
		env: env.NODE_ENV,
		version: systemConfig.appVersion,
		commit: systemConfig.gitCommit,
	},

	// Defence in depth. 
	redact: {
		paths: [
			"password",
			"*.password",
			"currentPassword",
			"*.currentPassword",
			"newPassword",
			"*.newPassword",
			"passwordHash",
			"*.passwordHash",
			"token",
			"*.token",
			"tokenHash",
			"*.tokenHash",
			"hashedToken",
			"*.hashedToken",
			"accessToken",
			"*.accessToken",
			"refreshToken",
			"*.refreshToken",
			"authorization",
			"*.authorization",
			"req.headers.authorization",
	        // Only the 2FA `code` on a request body is masked.
			"body.code",
			"req.body.code",
		],
		censor: "[redacted]",
	},
});

export default logger;
