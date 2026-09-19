// `bun test` sets this already; make it explicit so the DB resolver in
// @bakbak/db picks DEV_DB_TEST_URL and never touches the dev/prod database.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.JWT_ISSUER ??= "bakbak-api";
process.env.JWT_AUDIENCE ??= "bakbak-web";
process.env.FRONTEND_URL ??= "http://localhost:5173";

// Web push: give all test runs a workable (fake) VAPID identity so the push
// delivery path is exercised everywhere and the `web-push` client (mocked in
// ./mocks/web-push) is never left calling a real push service. The
// "unconfigured" branch of the config is covered by requiredInProduction.
process.env.VAPID_PUBLIC_KEY ??= "BKtestPublicKeyForBakBakTestBucket";
process.env.VAPID_PRIVATE_KEY ??= "testPrivateKeyForBakBakTestBucket";
process.env.VAPID_SUBJECT ??= "mailto:push@test.local";

// Rate limits, raised for the test/dev suite. Bun auto-loads the repo-root
// .env before this file runs, so plain `=` (not `??=`) is required — whatever
// the machine's config says, tests must never be throttled.
process.env.RATE_LIMIT_GLOBAL_CAPACITY = "5000";
process.env.RATE_LIMIT_GLOBAL_REFILL_PER_SEC = "100";
for (const bucket of [
  "LOGIN",
  "EMAIL",
  "UPLOADS",
  "USERNAME_CHECK",
  "FRIEND_REQUEST",
  "CHAT",
  "SETTINGS",
  "PASSWORD_CHANGE",
  "SESSIONS",
  "TWO_FACTOR_MANAGE",
]) {
  process.env[`RATE_LIMIT_${bucket}_CAPACITY`] = "500";
  process.env[`RATE_LIMIT_${bucket}_REFILL_PER_SEC`] = "50";
}

process.env.RESEND_API_KEY = "re_test_fake";

import "./mocks/email-service";
import "./mocks/web-push";
import "./mocks/resend";
