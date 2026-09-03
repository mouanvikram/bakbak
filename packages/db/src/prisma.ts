import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/prisma/client";
import { resolveDatabaseUrl } from "./resolve-db-url";

// Single source of truth: the repo-root .env file.
config({
	path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
	quiet: true,
});

const connectionString = resolveDatabaseUrl();

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };