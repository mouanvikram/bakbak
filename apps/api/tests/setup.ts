// `bun test` sets this already; make it explicit so the DB resolver in
// @bakbak/db picks DEV_DB_TEST_URL and never touches the dev/prod database.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.FRONTEND_URL ??= "http://localhost:5173";
