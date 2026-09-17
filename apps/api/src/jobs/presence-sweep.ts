import logger from "@/lib/logger";
import { chatRepository } from "@/services/service.container";
import { presenceConfig } from "@/redis/presence/config";
import { sweepExpiredPresence } from "@/redis/presence";
import { recordLastSeen } from "@/websocket/connection";
import { broadcastToChat } from "@/websocket/emitter";
import { registerJob } from "./registry";

// Users whose presence lease expired without a clean disconnect — typically
// every user of an API server that crashed — are handled here: their profile
// gets lastSeenAt (their last heartbeat), and their chats are told they went
// offline, so nobody is left showing a stale green dot.
registerJob({
  name: "presence-sweep",
  intervalMs: presenceConfig.sweepMs,
  run: async () => {
    const expired = await sweepExpiredPresence();
    if (expired.length === 0) return;

    await Promise.all(
      expired.map(({ userId, lastSeenAt }) =>
        recordLastSeen(userId, lastSeenAt),
      ),
    );

    const lastSeenByUser = new Map(
      expired.map(({ userId, lastSeenAt }) => [userId, lastSeenAt]),
    );
    const memberships = await chatRepository.findActiveMemberships([
      ...lastSeenByUser.keys(),
    ]);
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
