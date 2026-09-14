import webpush from "web-push";
import logger from "@/lib/logger";
import type {
  MessageResponseType,
  PushDeleteDto,
  PushUpsertDto,
} from "@bakbak/contracts";
import { pushConfig } from "./config";
import { PushRepository, type PushChatInfo, type PushTalkRow } from "./repository";

// The click target is a client-side route; the service worker opens it. Keep
// the path relative so it works on any deployed origin.
export interface MessagePushPayload {
  title: string;
  body: string;
  chatId: string;
  tag: string;
  /** Sender's avatar URL; the service worker draws it into the icon. */
  icon: string | null;
  /** For the initial-letter fallback when there's no usable avatar. */
  senderName: string;
}

export interface NotifyMessageDto {
  chatId: string;
  message: MessageResponseType;
}

function previewOf(message: MessageResponseType): string {
  const text = message.text?.trim();
  if (text) return text;
  const t = message.type;
  return t === "IMAGE"
    ? "Photo"
    : t === "VIDEO"
      ? "Video"
      : t === "AUDIO"
        ? "Voice message"
        : "Attachment";
}

export class PushService {
  constructor(private readonly pushRepository: PushRepository) {}

  async subscribe(dto: PushUpsertDto) {
    await this.pushRepository.upsertByEndpoint(
      dto.userId,
      dto.subscription,
      dto.userAgent,
    );
    return { ok: true };
  }

  async unsubscribe(dto: PushDeleteDto) {
    await this.pushRepository.deleteByEndpoint(dto.subscription.endpoint);
    return { ok: true };
  }

  /**
   * Send a web push for a new message to every enabled, subscribed recipient
   * in the chat. Fire-and-forget: the caller must not block the message send
   * on it, and failures here never surface to the sender.
   */
  async notifyMessage(dto: NotifyMessageDto): Promise<void> {
    if (!pushConfig.enabled) return;

    let chat: PushChatInfo | null = null;
    let subscriptions: PushTalkRow[] = [];
    try {
      [chat, subscriptions] = await Promise.all([
        this.pushRepository.findChatInfo(dto.chatId),
        this.pushRepository.findForMessage(dto.chatId, dto.message.senderId),
      ]);
      if (!chat) return;
    } catch (error) {
      logger.warn(
        { err: error, chatId: dto.chatId },
        "Failed to load push recipients; skipping push",
      );
      return;
    }

    if (subscriptions.length === 0) return;

    const isGroup = chat.type === "GROUP";
    const groupName = chat.name ?? null;

    webpush.setVapidDetails(
      pushConfig.subject,
      pushConfig.publicKey,
      pushConfig.privateKey,
    );

    const senderName =
      dto.message.sender?.profile?.displayName ||
      dto.message.sender?.username ||
      "Someone";

    const title = isGroup
      ? `${senderName} in ${groupName ?? "Group"}`
      : senderName;

    const payload: MessagePushPayload = {
      title,
      body: previewOf(dto.message),
      chatId: dto.chatId,
      tag: `message:${dto.chatId}`,
      icon: dto.message.sender?.profile?.avatar ?? null,
      senderName,
    };

    await Promise.allSettled(
      subscriptions.map((sub) =>
        this.sendOne(sub.endpoint, sub.p256dh, sub.auth, payload),
      ),
    );
  }

  private async sendOne(
    endpoint: string,
    p256dh: string,
    auth: string,
    payload: MessagePushPayload,
  ) {
    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh, auth } },
        JSON.stringify(payload),
        { TTL: pushConfig.ttlSeconds },
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The device dropped the subscription (or it expired) — forget it so
        // we stop pushing to a dead endpoint.
        await this.pushRepository.deleteByEndpoint(endpoint);
        return;
      }
      logger.warn(
        { err: error, statusCode: status, endpoint },
        "Web push delivery failed",
      );
    }
  }
}