/**
 * Picks the Postgres connection string for the current environment.
 *
 *   NODE_ENV=production  → PRODUCTION_DB_URL   (the managed/hosted database)
 *   NODE_ENV=test        → DEV_DB_TEST_URL     (throwaway — tests truncate it)
 *   otherwise            → DEV_DB_URL          (local dev, from infra/docker-compose)
 *
 * `DATABASE_URL`, if set, overrides all of the above — handy for one-off
 * scripts (e.g. seeding a specific database) and for hosts that only inject
 * that one conventional variable.
 */
export function resolveDatabaseUrl(): string {
  const override = process.env.DATABASE_URL;
  if (override) return override;

  const env = process.env.NODE_ENV;
  const key =
    env === "production"
      ? "PRODUCTION_DB_URL"
      : env === "test"
        ? "DEV_DB_TEST_URL"
        : "DEV_DB_URL";

  const url = process.env[key];
  if (!url) {
    throw new Error(
      `Database URL not configured: set ${key} (NODE_ENV=${env ?? "development"}) ` +
        `or DATABASE_URL. See .env.example and infra/README.md.`,
    );
  }
  return url;
}
