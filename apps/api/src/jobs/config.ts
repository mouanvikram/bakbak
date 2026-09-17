// Jobs module config — how often each background job runs.
//
// Plain literals: these are housekeeping cadences with no reason to differ per
// environment. The presence sweep is the exception and keeps its interval in
// `presenceConfig`, where it's env-tunable alongside the lease TTL it has to
// stay in step with.
const HOUR_MS = 60 * 60 * 1000;

export const jobsConfig = {
  intervals: {
    expiredRefreshTokensMs: HOUR_MS,
    expiredVerificationTokensMs: HOUR_MS,
    anonymizeDeletedUsersMs: 6 * HOUR_MS,
  },
};
