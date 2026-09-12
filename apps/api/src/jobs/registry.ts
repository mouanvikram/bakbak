import logger from "@/lib/logger";
import { registerShutdownHook } from "@/shutdown/registry";

type Job = {
  name: string;
  intervalMs: number;
  run: () => void | Promise<void>;
  runImmediately?: boolean;
};

const jobs: Job[] = [];
const running = new Set<ReturnType<typeof setInterval>>();
let started = false;

export function registerJob(job: Job): void {
  jobs.push(job);
}

// Starts every registered job once, then clears their timers on shutdown.
// Idempotent so a future boot-time re-run can't double-schedule.
export function startJobs(): void {
  if (started) return;
  started = true;

  for (const job of jobs) {
    if (job.runImmediately) {
      void runSafely(job);
    }
    const timer = setInterval(() => void runSafely(job), job.intervalMs);
    timer.unref?.();
    running.add(timer);
  }

  registerShutdownHook(() => {
    for (const timer of running) {
      clearInterval(timer);
    }
    running.clear();
  });
}

// Safety net: a job that throws is logged instead of tripping the global
// unhandled-rejection handler, which would force-exit the process.
async function runSafely(job: Job): Promise<void> {
  try {
    await job.run();
  } catch (error) {
    logger.error({ err: error, job: job.name }, "Background job failed");
  }
}
