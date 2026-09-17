import logger from "@/lib/logger";
import { uploadService } from "@/services/service.container";
import { jobsConfig } from "./config";
import { registerJob } from "./registry";

registerJob({
  name: "orphan-attachments",
  intervalMs: jobsConfig.intervals.orphanAttachmentCleanupMs,
  runImmediately: true,
  run: async () => {
    try {
      const cutoff = new Date(Date.now() - jobsConfig.orphanGraceMs);
      const { deleted, failed } = await uploadService.cleanupOrphans(cutoff);

      if (deleted > 0 || failed > 0) {
        logger.info({ deleted, failed }, "Cleaned up orphaned attachments");
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to clean up orphaned attachments");
    }
  },
});
