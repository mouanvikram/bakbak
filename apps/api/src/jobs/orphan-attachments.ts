import logger from "@/lib/logger";
import { uploadService } from "@/services/service.container";
import { runWithLock } from "@/redis/lock";
import { jobsConfig } from "./config";
import { registerJob } from "./registry";

registerJob({
  name: "orphan-attachments",
  intervalMs: jobsConfig.intervals.orphanAttachmentCleanupMs,
  runImmediately: true,
  run: async () => {
    // Every instance schedules this job; only one may run it at a time or two
    // instances select the same rows and race their deletions.
    const result = await runWithLock(
      "lock:jobs:orphan-attachments",
      jobsConfig.orphanLockTtlMs,
      async () => {
        const cutoff = new Date(Date.now() - jobsConfig.orphanGraceMs);
        return await uploadService.cleanupOrphans(cutoff);
      },
    );

    if (!result) {
      logger.debug(
        { job: "orphan-attachments" },
        "Skipped orphan cleanup; another instance holds the lock",
      );
      return;
    }

    if (result.deleted > 0 || result.failed > 0) {
      logger.info(
        { deleted: result.deleted, failed: result.failed },
        "Cleaned up orphaned attachments",
      );
    }
  },
});
