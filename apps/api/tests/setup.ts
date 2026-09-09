// `bun test` sets this already; make it explicit so the DB resolver in
// @bakbak/db picks DEV_DB_TEST_URL and never touches the dev/prod database.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.JWT_ISSUER ??= "bakbak-api";
process.env.JWT_AUDIENCE ??= "bakbak-web";
process.env.FRONTEND_URL ??= "http://localhost:5173";

// Rate limits, raised for the test/dev suite.
for (const bucket of [
  "LOGIN",
  "EMAIL",
  "UPLOADS",
  "MESSAGE_SEND",
  "USERNAME_CHECK",
  "FRIEND_REQUEST",
  "CHAT",
]) {
  process.env[`RATE_LIMIT_${bucket}_CAPACITY`] ??= "80";
}

process.env.RESEND_API_KEY = "re_test_fake";

import "./mocks/email-service";
