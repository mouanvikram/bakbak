import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dir, "../../../../.env"), quiet: true });

// Global-only config: process identity + HTTP surface. Everything
// module-specific lives in that module's own config file
// (apps/api/src/<module>/config.ts), which reads process.env directly so
// no import cycle through here is possible.
const DEFAULT_CORS_ORIGINS = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
];

function parseOrigins(raw?: string): string[] {
	if (!raw) return DEFAULT_CORS_ORIGINS;
	return raw
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
}

export const env = {
	NODE_ENV: process.env.NODE_ENV ?? "development",
	PORT: Number(process.env.PORT) || 3000,
	CORS_ORIGINS: parseOrigins(process.env.CORS_ORIGINS),
};
