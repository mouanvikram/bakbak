import { prisma } from "@bakbak/db";
import logger from "@/lib/logger";
import { presenceConfig } from "@/redis/presence/config";
import { sweepExpiredPresence } from "@/redis/presence";
import { markPresence } from "@/websocket/connection";
import { broadcastToChat } from "@/websocket/emitter";
import { registerJob } from "./registry";

// Users whose presence lease expired without a clean disconnect — typically
// every user of an API server that crashed — are marked offline here: the
// profile gets isOnline=false + lastSeenAt (their last heartbeat), and their
// chats are told, so nobody is left showing a stale green dot.
registerJob({
  name: "presence-sweep",
  intervalMs: presenceConfig.sweepMs,
  run: async () => {
    const expired = await sweepExpiredPresence();
    if (expired.length === 0) return;

    await Promise.all(
      expired.map(({ userId, lastSeenAt }) =>
        markPresence(userId, false, lastSeenAt),
      ),
    );

    const lastSeenByUser = new Map(
      expired.map(({ userId, lastSeenAt }) => [userId, lastSeenAt]),
    );
    const memberships = await prisma.chatParticipant.findMany({
      where: { userId: { in: [...lastSeenByUser.keys()] }, leftAt: null },
      select: { chatId: true, userId: true },
    });
    for (const { chatId, userId } of memberships) {
      broadcastToChat(chatId, "presence", {
        userId,
        online: false,
        lastSeenAt: lastSeenByUser.get(userId)!.toISOString(),
      });
    }

    logger.info(
      { users: expired.length },
      "Marked users with expired presence leases offline",
    );
  },
});
