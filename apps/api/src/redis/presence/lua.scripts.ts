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

// Finds users whose newest lease has expired (their API server crashed or
// they stopped heartbeating without a clean disconnect) and removes them from
// the online index. Returns a flat list: userId, lastLeaseExpiry, ...
// KEYS[1] = presence:online · ARGV[1] = "presence:user:" prefix · ARGV[2] = batch size
// Per-user keys are built from ARGV, which is fine on a single Redis but not
// Redis Cluster (keys must be declared up front there).
export const PRESENCE_SWEEP_SCRIPT = `
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local expired = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", now, "WITHSCORES", "LIMIT", 0, tonumber(ARGV[2]))
local out = {}

for i = 1, #expired, 2 do
  local userId = expired[i]
  local socketsKey = ARGV[1] .. userId
  redis.call("ZREMRANGEBYSCORE", socketsKey, "-inf", now)
  -- A live socket left means a heartbeat is due to raise the score; leave it.
  if redis.call("ZCARD", socketsKey) == 0 then
    redis.call("ZREM", KEYS[1], userId)
    table.insert(out, userId)
    table.insert(out, expired[i + 1])
  end
end

return out
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
