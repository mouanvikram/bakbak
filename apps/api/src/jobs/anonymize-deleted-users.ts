import logger from "@/lib/logger";
import { authConfig } from "@/auth/config";
import { userRepository } from "@/services/service.container";
import { jobsConfig } from "./config";
import { registerJob } from "./registry";

registerJob({
  name: "anonymize-deleted-users",
  intervalMs: jobsConfig.intervals.anonymizeDeletedUsersMs,
  runImmediately: true,
  run: async () => {
    try {
      const cutoff = new Date(Date.now() - authConfig.accountRecoveryWindowMs);
      const stale = await userRepository.findDeletedSince(cutoff);

      let anonymized = 0;
      for (const user of stale) {
        await userRepository.anonymizeAccount(user.id);
        anonymized += 1;
      }

      if (anonymized > 0) {
        logger.info({ anonymized }, "Anonymized expired deleted accounts");
      }
    } catch (error) {
      logger.error(
        { err: error },
        "Failed to anonymize expired deleted accounts",
      );
    }
  },
});