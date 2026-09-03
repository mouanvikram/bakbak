import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dir, "../../../../.env"), quiet: true });

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
	LOGIN_MAX_ATTEMPTS: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
	LOGIN_LOCKOUT_MS: Number(process.env.LOGIN_LOCKOUT_MS) || 15 * 60 * 1000,
	STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT ?? "localhost",
	STORAGE_PORT: Number(process.env.STORAGE_PORT) || 9000,
	STORAGE_USE_SSL: (process.env.STORAGE_USE_SSL ?? "false") === "true",
	STORAGE_REGION: process.env.STORAGE_REGION ?? "us-east-1",
	STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY ?? "minioadmin",
	STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY ?? "minioadmin",
	STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? "bakbak",
	STORAGE_PUBLIC_URL: process.env.STORAGE_PUBLIC_URL ?? "",
};
