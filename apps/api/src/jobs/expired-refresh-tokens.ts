import logger from "@/lib/logger";
import { refreshTokenRepository } from "@/services/service.container";
import { jobsConfig } from "./config";
import { registerJob } from "./registry";

registerJob({
  name: "expired-refresh-tokens",
  intervalMs: jobsConfig.intervals.expiredRefreshTokensMs,
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