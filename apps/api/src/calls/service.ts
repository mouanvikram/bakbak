import { createHmac } from "node:crypto";
import type {
  CallHistoryResponseType,
  CallRecordType,
  IceServersResponseType,
} from "@bakbak/contracts";
import logger from "@/lib/logger";
import { broadcastMessage } from "@/websocket/emitter";
import type { MessageService } from "@/messages/service";
import { callsConfig } from "./config";
import type { CallRow, CallsRepository } from "./repository";

// Enough to fill the Calls tab without paginating; the list is a recent-history
// view, not an archive.
const HISTORY_LIMIT = 100;

export class CallsService {
  constructor(
    private readonly callsRepository: CallsRepository,
    private readonly messageService: MessageService,
  ) {}

  /**
   * ICE servers for an RTCPeerConnection, with TURN credentials valid for
   * `credentialTtlSeconds`.
   *
   * coturn's REST-API scheme: the username is `<unix-expiry>:<userId>` and
   * the password is base64(HMAC-SHA1(username, shared secret)). coturn
   * recomputes the same HMAC on connect, so credentials are never stored,
   * never synchronised between the two services, and stop working on their
   * own once the embedded expiry passes.
   *
   * The userId is in the username so relayed traffic is attributable in
   * coturn's logs — it is not a secret and grants nothing by itself.
   */
  getIceServers(userId: string): IceServersResponseType {
    const { stunUrls, turnUrls, credentialTtlSeconds, enabled } = callsConfig;
    const iceServers: IceServersResponseType["iceServers"] = [];

    if (stunUrls.length > 0) {
      iceServers.push({ urls: stunUrls });
    }

    if (enabled) {
      const expiresAt = Math.floor(Date.now() / 1000) + credentialTtlSeconds;
      const username = `${expiresAt}:${userId}`;
      const credential = createHmac("sha1", callsConfig.staticAuthSecret)
        .update(username)
        .digest("base64");

      iceServers.push({ urls: turnUrls, username, credential });
    }

    return { iceServers, ttlSeconds: credentialTtlSeconds };
  }

  // ── Lifecycle, driven by the socket signalling ──────────────────────────
  // Every one of these swallows its own errors: a history row failing to
  // write must never stop a call from connecting.

  /** Opens a RINGING row for a new offer. Returns null for a group chat or a
   * chat whose other side has left — the call still proceeds, unrecorded. */
  async recordOffer(
    chatId: string,
    callerId: string,
    type: "AUDIO" | "VIDEO",
  ): Promise<string | null> {
    try {
      const calleeId = await this.callsRepository.findDirectCallee(
        chatId,
        callerId,
      );
      if (!calleeId) return null;
      const { id } = await this.callsRepository.createRinging({
        chatId,
        callerId,
        calleeId,
        type,
      });
      return id;
    } catch (err) {
      logger.warn({ err, chatId, callerId }, "Failed to record call offer");
      return null;
    }
  }

  async recordAnswer(chatId: string): Promise<void> {
    try {
      const live = await this.callsRepository.findLive(chatId);
      if (live) await this.callsRepository.markAnswered(live.id);
    } catch (err) {
      logger.warn({ err, chatId }, "Failed to record call answer");
    }
  }

  /**
   * Closes the live row for a chat.
   *
   * The final status is decided here rather than taken from the client: a
   * connected call ends as ANSWERED; otherwise whoever hung up decides. The
   * callee walking away is DECLINED, the caller giving up leaves the callee
   * with a MISSED call — which is the entry the Calls tab exists to show.
   */
  async recordEnd(
    chatId: string,
    endedBy: string,
    reason: string,
  ): Promise<void> {
    try {
      const live = await this.callsRepository.findLive(chatId);
      if (!live) return;

      const status =
        live.status === "ANSWERED"
          ? "ANSWERED"
          : reason === "FAILED"
            ? "FAILED"
            : // A ring-out is a missed call whichever end noticed it first.
              // Without this branch a callee whose timer fired would be
              // recorded as having declined, which it plainly didn't.
              reason === "TIMEOUT"
              ? "MISSED"
              : endedBy === live.calleeId
                ? "DECLINED"
                : "MISSED";

      await this.callsRepository.markEnded(live.id, status);

      // Post the call into the conversation. Returns null when the other peer
      // already posted it (unique callId), so a two-sided hang-up still yields
      // exactly one entry.
      const messageId = await this.callsRepository.createCallMessage(live);
      if (messageId) await this.broadcastCallMessage(chatId, messageId);
    } catch (err) {
      logger.warn({ err, chatId }, "Failed to record call end");
    }
  }

  /**
   * Pushes the new timeline entry to everyone in the chat.
   *
   * Separate from recordEnd's try/catch on purpose: a failed broadcast must not
   * make it look like the call failed to record. The row is already written, so
   * the entry appears on next load either way.
   */
  private async broadcastCallMessage(
    chatId: string,
    messageId: string,
  ): Promise<void> {
    try {
      const message = await this.messageService.getMessageForBroadcast(
        messageId,
      );
      if (message) broadcastMessage(chatId, message);
    } catch (err) {
      logger.warn({ err, chatId, messageId }, "Failed to broadcast call entry");
    }
  }

  // ── History ────────────────────────────────────────────────────────────

  async getHistory(userId: string): Promise<CallHistoryResponseType> {
    const rows = await this.callsRepository.findHistoryFor(
      userId,
      HISTORY_LIMIT,
    );
    return { calls: rows.map((row) => toRecord(row, userId)) };
  }
}

function toRecord(row: CallRow, viewerId: string): CallRecordType {
  const outgoing = row.callerId === viewerId;
  const peer = outgoing ? row.callee : row.caller;

  // Only a connected call has a duration; a missed one lasted no time at all
  // even though it sat ringing.
  const durationSeconds =
    row.answeredAt && row.endedAt
      ? Math.max(
          0,
          Math.round(
            (row.endedAt.getTime() - row.answeredAt.getTime()) / 1000,
          ),
        )
      : null;

  return {
    id: row.id,
    chatId: row.chatId,
    type: row.type,
    // A row still marked RINGING is one whose call never closed cleanly
    // (a crash, a lost socket); to the person reading the list it was missed.
    status: row.status === "RINGING" ? "MISSED" : row.status,
    direction: outgoing ? "OUTGOING" : "INCOMING",
    peer: {
      id: peer.id,
      username: peer.username,
      displayName: peer.displayName,
      avatar: peer.avatar,
    },
    startedAt: row.startedAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    durationSeconds,
  };
}
