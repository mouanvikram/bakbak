import dotenv from "dotenv";
dotenv.config();

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
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  CORS_ORIGINS: parseOrigins(process.env.CORS_ORIGINS),
};
