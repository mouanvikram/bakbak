import Redis from "ioredis";
import logger from "@/lib/logger";
import { redisConfig } from "./config";

// Token-bucket Lua: atomic read/refill/deduct per key. 
const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])

local time = redis.call("TIME")
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

local tokens = tonumber(redis.call("HGET", KEYS[1], "tokens"))
local timestamp = tonumber(redis.call("HGET", KEYS[1], "timestamp"))

if tokens == nil then
    tokens = capacity
end

if timestamp == nil then
    timestamp = now
end

local elapsed = math.max(0, now - timestamp)
local refill = (elapsed / 1000) * refill_rate

tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local missing = requested - tokens

    if refill_rate > 0 then
        retry_after = math.ceil(missing / refill_rate)
    end
end

redis.call(
    "HSET",
    KEYS[1],
    "tokens", tokens,
    "timestamp", now
)

local ttl = 0
if refill_rate > 0 then
    ttl = math.ceil(capacity / refill_rate)
end

if ttl > 0 then
    redis.call("EXPIRE", KEYS[1], ttl)
end

return {
    allowed,
    math.floor(tokens),
    retry_after
}
`;

let redis: Redis | null = null;

// Gate for the cache: true only while a connection is actually usable. 
export function isRedisReady(): boolean {
	return redis?.status === "ready";
}

export function getRedisClient(): Redis {
	if (redis) {
		return redis;
	}

	redis = new Redis({
		host: redisConfig.host,
		port: redisConfig.port,
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
	});
	redis.defineCommand("consumeBucket", {
		numberOfKeys: 1,
		lua: TOKEN_BUCKET_SCRIPT,
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
	void redis.quit().catch(() => redis?.disconnect());
	redis = null;
}
