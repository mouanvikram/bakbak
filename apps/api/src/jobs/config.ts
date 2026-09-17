// Jobs module config — how often each background job runs.
//
// Plain literals: these are housekeeping cadences with no reason to differ per
// environment. The presence sweep is the exception and keeps its interval in
// `presenceConfig`, where it's env-tunable alongside the lease TTL it has to
// stay in step with.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const jobsConfig = {
  intervals: {
    expiredRefreshTokensMs: HOUR_MS,
    expiredVerificationTokensMs: HOUR_MS,
    anonymizeDeletedUsersMs: 6 * HOUR_MS,
    orphanAttachmentCleanupMs: HOUR_MS,
  },
  // Attachments younger than this are left alone: an upload that hasn't been
  // sent yet, or an avatar the profile might still be pointing at, is not an
  // orphan. A day is far longer than any open composer survives.
  orphanGraceMs: DAY_MS,
};
