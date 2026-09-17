import logger from "@/lib/logger";
import { emailRepository } from "@/services/service.container";
import { jobsConfig } from "./config";
import { registerJob } from "./registry";

registerJob({
  name: "expired-verification-tokens",
  intervalMs: jobsConfig.intervals.expiredVerificationTokensMs,
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