import logger from "@/lib/logger";
import { callsService, chatRepository } from "@/services/service.container";
import type { AuthenticatedSocket } from "@/websocket/auth";
import { rooms } from "@/websocket/rooms";
import {
  callAnswerSchema,
  callEndSchema,
  callIceCandidateSchema,
  callOfferSchema,
} from "@bakbak/contracts";

// WebRTC is peer-to-peer once connected; the server only relays the handshake
// — the SDP offer/answer, then ICE candidates as they trickle in. It never
// parses, stores, or forwards media.
//
// Every payload is parsed and every relay is gated on the sender being an
// active participant of the chat. Without that check a stranger holding a
// chatId could ring its members, or push SDP at them mid-call.
//
// Alongside the relay, each step updates the call's history row (see
// calls/service.ts). That bookkeeping is deliberately best-effort: a failed
// write is logged and the call carries on.

async function canSignal(chatId: string, userId: string): Promise<boolean> {
  try {
    return await chatRepository.isActiveParticipant(chatId, userId);
  } catch (err) {
    // Fail closed, but say so: while this throws, calls silently stop working.
    logger.warn(
      { err, chatId, userId },
      "Call signalling membership check failed; dropping the event",
    );
    return false;
  }
}

export function registerCallSignaling(socket: AuthenticatedSocket) {
  const s = socket;
  const { userId, username } = s.data;

  // Caller → callee. Broadcast to the chat room rather than a specific
  // socket, so a callee connected on several devices rings on all of them.
  s.on("call:offer", async (payload: unknown) => {
    const parsed = callOfferSchema.safeParse(payload);
    if (!parsed.success) return;

    const { chatId, sdp, callType } = parsed.data;
    if (!(await canSignal(chatId, userId))) return;

    const callId = await callsService.recordOffer(chatId, userId, callType);

    s.to(rooms.chat(chatId)).emit("call:incoming", {
      chatId,
      callId,
      from: userId,
      fromUsername: username,
      sdp,
      callType,
    });
  });

  // Callee → caller.
  s.on("call:answer", async (payload: unknown) => {
    const parsed = callAnswerSchema.safeParse(payload);
    if (!parsed.success) return;

    const { chatId, sdp } = parsed.data;
    if (!(await canSignal(chatId, userId))) return;

    await callsService.recordAnswer(chatId);

    s.to(rooms.chat(chatId)).emit("call:answered", {
      chatId,
      from: userId,
      sdp,
    });
  });

  // Trickle ICE, in both directions, for the life of the negotiation.
  s.on("call:ice-candidate", async (payload: unknown) => {
    const parsed = callIceCandidateSchema.safeParse(payload);
    if (!parsed.success) return;

    const { chatId, candidate } = parsed.data;
    if (!(await canSignal(chatId, userId))) return;

    s.to(rooms.chat(chatId)).emit("call:ice-candidate", {
      chatId,
      from: userId,
      candidate,
    });
  });

  // Hang up, reject, or give up — one event, distinguished by `reason`, so
  // the far end always has a single place to tear the connection down.
  s.on("call:end", async (payload: unknown) => {
    const parsed = callEndSchema.safeParse(payload);
    if (!parsed.success) return;

    const { chatId, reason } = parsed.data;
    if (!(await canSignal(chatId, userId))) return;

    await callsService.recordEnd(chatId, userId, reason);

    s.to(rooms.chat(chatId)).emit("call:ended", {
      chatId,
      from: userId,
      reason,
    });
  });
}
