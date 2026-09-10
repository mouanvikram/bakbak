import logger from "@/lib/logger";
import { refreshTokenRepository } from "@/services/service.container";
import { registerJob } from "./registry";

const EXPIRED_REFRESH_TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

registerJob({
  name: "expired-refresh-tokens",
  intervalMs: EXPIRED_REFRESH_TOKEN_CLEANUP_INTERVAL_MS,
  runImmediately: true,
  run: async () => {
    try {
      const result = await refreshTokenRepository.deleteExpired();
      if (result.count > 0) {
        logger.info(
          { deleted: result.count },
          "Cleaned up expired refresh tokens",
        );
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to clean up expired refresh tokens");
    }
  },
});