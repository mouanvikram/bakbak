import { createAdapter } from "@socket.io/redis-adapter";
import type { Server } from "socket.io";
import { createAdapterClients } from "../client";

export function attachRedisAdapter(io: Server): () => Promise<void> {
  const { pub, sub } = createAdapterClients();
  io.adapter(createAdapter(pub, sub, { requestsTimeout: 10_000 }));

  return async () => {
    await Promise.allSettled([pub.quit(), sub.quit()]);
  };
}
