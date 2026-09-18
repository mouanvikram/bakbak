import { z } from "zod";

// ── ICE configuration ─────────────────────────────────────────────────────

// One entry of an RTCPeerConnection's `iceServers` array. STUN entries carry
// no credentials; TURN entries carry the short-lived pair minted per request.
export const iceServerSchema = z.object({
  urls: z.array(z.string().min(1)).min(1),
  username: z.string().min(1).optional(),
  credential: z.string().min(1).optional(),
});

export type IceServerType = z.infer<typeof iceServerSchema>;

// GET /api/v1/calls/ice-servers. `ttlSeconds` is how long the TURN
// credentials remain valid, so a client can refresh before a long call
// outlives them. Returns STUN only when TURN isn't configured, which
// still connects any peers whose NATs allow a direct path.
export const iceServersResponseSchema = z.object({
  iceServers: z.array(iceServerSchema),
  ttlSeconds: z.number().int().positive(),
});

export type IceServersResponseType = z.infer<typeof iceServersResponseSchema>;

// ── Socket signalling ─────────────────────────────────────────────────────
// The server relays the WebRTC handshake and nothing else: media never
// touches it. Payloads arrive from clients, so every one is parsed before
// it is forwarded.

export const callTypeSchema = z.enum(["AUDIO", "VIDEO"]);
export type CallTypeType = z.infer<typeof callTypeSchema>;

// SDP is a few KB in practice; the cap is generous but bounded so a peer
// can't push an unbounded blob through the relay.
const sdpSchema = z.string().min(1).max(100_000);

export const callOfferSchema = z.object({
  chatId: z.string().min(1),
  sdp: sdpSchema,
  callType: callTypeSchema,
});

export type CallOfferType = z.infer<typeof callOfferSchema>;

export const callAnswerSchema = z.object({
  chatId: z.string().min(1),
  sdp: sdpSchema,
});

export type CallAnswerType = z.infer<typeof callAnswerSchema>;

// Trickle ICE: candidates arrive one at a time after the offer/answer, so
// this fires many times per call and stays deliberately small.
export const callIceCandidateSchema = z.object({
  chatId: z.string().min(1),
  candidate: z.object({
    candidate: z.string().max(1000),
    sdpMid: z.string().max(100).nullish(),
    sdpMLineIndex: z.number().int().nonnegative().nullish(),
    usernameFragment: z.string().max(200).nullish(),
  }),
});

export type CallIceCandidateType = z.infer<typeof callIceCandidateSchema>;

export const callEndReasonSchema = z.enum([
  "HANGUP",
  "REJECTED",
  "BUSY",
  "FAILED",
  "TIMEOUT",
]);

export type CallEndReasonType = z.infer<typeof callEndReasonSchema>;

export const callEndSchema = z.object({
  chatId: z.string().min(1),
  reason: callEndReasonSchema.default("HANGUP"),
});

export type CallEndType = z.infer<typeof callEndSchema>;

// ── Call history ──────────────────────────────────────────────────────────

export const callStatusSchema = z.enum([
  "RINGING",
  "ANSWERED",
  "MISSED",
  "DECLINED",
  "FAILED",
]);

export type CallStatusType = z.infer<typeof callStatusSchema>;

// Which way the call went, from the point of view of whoever asked for the
// list — the same row is outgoing for one participant and incoming for the
// other, so this is computed per request rather than stored.
export const callDirectionSchema = z.enum(["INCOMING", "OUTGOING"]);

export type CallDirectionType = z.infer<typeof callDirectionSchema>;

export const callPeerSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullish(),
  avatar: z.string().nullish(),
});

export const callRecordSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  type: callTypeSchema,
  status: callStatusSchema,
  direction: callDirectionSchema,
  /** The other person, whichever side of the call you were on. */
  peer: callPeerSchema,
  startedAt: z.string(),
  answeredAt: z.string().nullish(),
  endedAt: z.string().nullish(),
  /** answeredAt→endedAt in whole seconds; null unless the call connected. */
  durationSeconds: z.number().int().nonnegative().nullish(),
});

export type CallRecordType = z.infer<typeof callRecordSchema>;

export const callHistoryResponseSchema = z.object({
  calls: z.array(callRecordSchema),
});

export type CallHistoryResponseType = z.infer<typeof callHistoryResponseSchema>;
