import { prisma } from "@bakbak/db";
import type { PushSubscriptionRequestType } from "@bakbak/contracts";

export interface PushTalkRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
}

export interface PushChatInfo {
  type: "DIRECT" | "GROUP";
  name: string | null;
}

export class PushRepository {
  /** Create or take over the row owned by `endpoint` (re-subscribe on the
   * same device updates keys/user instead of piling up rows). */
  async upsertByEndpoint(
    userId: string,
    subscription: PushSubscriptionRequestType,
    userAgent: string | undefined,
  ) {
    const { endpoint, keys } = subscription;
    return await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    });
  }

  async deleteByEndpoint(endpoint: string) {
    return await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Name/type of a chat, for building notification copy. Reuses the chat
   * row already loaded by the message path when available. */
  async findChatInfo(chatId: string): Promise<PushChatInfo | null> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { type: true, name: true },
    });
    return chat ? { type: chat.type, name: chat.name } : null;
  }

  /**
   * User ids (in `chatId`) who should get push for a new message: active
   * participants, not the sender, account alive, Messages not turned off.
   * A missing settings row counts as "on" (the default).
   */
  async findRecipientIds(
    chatId: string,
    senderId: string,
  ): Promise<Set<string>> {
    const participants = await prisma.chatParticipant.findMany({
      where: { chatId, leftAt: null, userId: { not: senderId } },
      select: {
        userId: true,
        user: {
          select: {
            deletedAt: true,
            settings: { select: { notifyMessages: true } },
          },
        },
      },
    });

    return new Set(
      participants
        .filter(
          (p) =>
            p.user.deletedAt === null &&
            (p.user.settings === null || p.user.settings.notifyMessages),
        )
        .map((p) => p.userId),
    );
  }

  /** All push subscriptions reachable for a new message in `chatId`. */
  async findForMessage(chatId: string, senderId: string): Promise<PushTalkRow[]> {
    const [recipients, subscriptions] = await Promise.all([
      this.findRecipientIds(chatId, senderId),
      prisma.pushSubscription.findMany({
        where: {
          userId: { not: senderId },
          user: { deletedAt: null },
        },
      }),
    ]);

    return subscriptions.filter((sub) => recipients.has(sub.userId));
  }
}