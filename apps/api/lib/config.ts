import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dir, "../../../.env") });

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

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
	throw new Error(
		"JWT_SECRET is missing. Set it in the repo-root .env file (see .env.example).",
	);
}

export const env = {
	NODE_ENV: process.env.NODE_ENV ?? "development",
	PORT: Number(process.env.PORT) || 3000,
	JWT_SECRET: jwtSecret,
	FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
	CORS_ORIGINS: parseOrigins(process.env.CORS_ORIGINS),
	RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
	RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
};
