// `bun test` sets this already; make it explicit so the DB resolver in
// @bakbak/db picks DEV_DB_TEST_URL and never touches the dev/prod database.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.JWT_ISSUER ??= "bakbak-api";
process.env.JWT_AUDIENCE ??= "bakbak-web";
process.env.FRONTEND_URL ??= "http://localhost:5173";

// Never let a test reach the real mail provider — force a dummy key and
// replace EmailService wholesale (see ./mocks/email-service). Overwrites any
// real key from a local .env.
process.env.RESEND_API_KEY = "re_test_fake";

import "./mocks/email-service";
