import Redis from "ioredis";
import logger from "@/lib/logger";
import { redisConfig } from "./config";

let redis: Redis | null = null;

export function getRedisClient(): Redis {
	if (redis) {
		return redis;
	}

	redis = new Redis({
		host: redisConfig.host,
		port: Number(redisConfig.port),
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
	});
	redis.on("connect", () => {
		logger.info("[Redis] connected");
	});

	redis.on("ready", () => {
		logger.info("[Redis] ready");
	});

	redis.on("error", (error) => {
		logger.error({ err: error }, "[Redis] error");
	});

	redis.on("close", () => {
		logger.info("[Redis] connection closed");
	});

	redis.on("disconnect", () => {
		logger.info("[Redis] disconnected");
	});

	return redis;
}

export function closeRedisClient(): void {
	if (!redis) return;
	const client = redis;
	redis = null;

	// Graceful close first: stop the client and flush any pending commands.
	// If that rejects or hangs (e.g. a dead connection), force-disconnect so
	// the process can still exit.
	void client.quit().catch(() => client.disconnect());
}
