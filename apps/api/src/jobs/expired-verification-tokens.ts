import logger from "@/lib/logger";
import { emailRepository } from "@/services/service.container";
import { registerJob } from "./registry";

const EXPIRED_VERIFICATION_TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

registerJob({
  name: "expired-verification-tokens",
  intervalMs: EXPIRED_VERIFICATION_TOKEN_CLEANUP_INTERVAL_MS,
  runImmediately: true,
  run: async () => {
    try {
      const result = await emailRepository.deleteExpired();
      if (result.count > 0) {
        logger.info(
          { deleted: result.count },
          "Cleaned up expired verification tokens",
        );
      }
    } catch (error) {
      logger.error(
        { err: error },
        "Failed to clean up expired verification tokens",
      );
    }
  },
});