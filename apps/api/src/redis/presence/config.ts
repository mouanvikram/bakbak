import { positiveNum } from "@/config/parse";

export const presenceConfig = {
  socketTtlMs: positiveNum(process.env.PRESENCE_SOCKET_TTL_MS, 90_000),
  heartbeatMs: positiveNum(process.env.PRESENCE_HEARTBEAT_MS, 30_000),
  sweepMs: positiveNum(process.env.PRESENCE_SWEEP_MS, 30_000),
};
