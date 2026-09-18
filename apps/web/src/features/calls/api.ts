import type {
  CallHistoryResponseType,
  IceServersResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";

/**
 * STUN/TURN servers for a new RTCPeerConnection. Fetched per call rather than
 * once at boot: the TURN credentials are short-lived, so a pair cached at
 * login would be expired by the time anyone rang.
 */
export function getIceServers(): Promise<IceServersResponseType> {
  return apiClient("/api/v1/calls/ice-servers");
}

/** Recent calls in both directions, newest first. */
export function listCallHistory(): Promise<CallHistoryResponseType> {
  return apiClient("/api/v1/calls/history");
}
