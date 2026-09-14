export const PRESENCE_TOUCH_SCRIPT = `
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local expires = now + tonumber(ARGV[2])

redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
local before = redis.call("ZCARD", KEYS[1])

redis.call("ZADD", KEYS[1], expires, ARGV[1])
redis.call("PEXPIRE", KEYS[1], ARGV[2])
redis.call("ZADD", KEYS[2], "GT", expires, ARGV[3])

if before == 0 then return 1 end
return 0
`;

export const PRESENCE_RELEASE_SCRIPT = `
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

if ARGV[1] ~= "" then
  redis.call("ZREM", KEYS[1], ARGV[1])
end
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)

if redis.call("ZCARD", KEYS[1]) > 0 then
  return { 0, now }
end

if redis.call("ZREM", KEYS[2], ARGV[2]) == 1 then
  return { 1, now }
end
return { 0, now }
`;
