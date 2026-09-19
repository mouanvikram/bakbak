# infra

Local infrastructure for development and testing: a Postgres instance with a
**dev** database and a throwaway **test** database, SeaweedFS for uploads,
Redis for rate limiting and caching, and the Prometheus/Loki/Grafana
observability stack. Nothing here is used in production.

## Databases

`@bakbak/db` chooses the connection string by `NODE_ENV`:

| `NODE_ENV`      | variable            | database                                          |
| --------------- | ------------------- | ------------------------------------------------- |
| `production`    | `PRODUCTION_DB_URL` | the deploy host's own Postgres (`127.0.0.1:5432`) |
| `test`          | `DEV_DB_TEST_URL`   | `bakbak_test` (truncated by the suite)            |
| _anything else_ | `DEV_DB_URL`        | `bakbak_dev`                                      |

Set `DATABASE_URL` to override all three (one-off scripts, hosts that only
inject one variable). The Prisma CLI resolves the same way, which works because
nothing sits in front of Postgres — if a transaction pooler (PgBouncer, RDS
Proxy, Neon's `-pooler` host) is ever introduced, migrations will need a
separate direct connection: Prisma Migrate takes a session-level advisory lock
that a transaction pooler cannot hold, and fails with error P1002.

## Bring the stack up

`bun run infra:up` starts the whole local stack — Postgres (dev + test DBs),
SeaweedFS, Redis, and the Prometheus/Loki/Grafana observability trio:

```bash
bun run infra:up
bun --cwd packages/db exec prisma migrate deploy          # migrate bakbak_dev
```

`bun run dev` then talks to the local stack. Stop it with:

```bash
bun run infra:down            # the whole stack (add -v to wipe data)
```

Ports: Postgres `5432`, SeaweedFS S3 `8333` (filer `8888`, master `9333`;
creds `seaweedfs` / `seaweedfs`), Redis `6379`, Prometheus `9090`, Loki `3100`,
Grafana `3001`.

## Run the tests in a container

```bash
docker compose -f infra/docker-compose.yml --profile test run --rm tests
```

This builds `infra/Dockerfile`, waits for Postgres, runs
`prisma migrate deploy` against `bakbak_test`, then the API suite. The suite
truncates every table between cases, so it must never point at `bakbak_dev`
or `PRODUCTION_DB_URL` — `NODE_ENV=test` guarantees `DEV_DB_TEST_URL`.

Inside the container the service hostnames are `postgres`, `seaweedfs` and
`redis` — never `localhost`, which resolves to the test container itself.
The `tests` service sets each one explicitly; `REDIS_URL` in particular must
be passed, because the config otherwise falls back to `REDIS_HOST=localhost`
and every connection retries against nothing.

To run the suite on the host instead (against the same containers):

```bash
docker compose -f infra/docker-compose.yml up -d postgres seaweedfs seaweedfs-init redis
NODE_ENV=test bun --cwd packages/db exec prisma migrate deploy
bun --cwd apps/api run test
```

Leave `redis` out and the cache, lock, presence and rate-limit suites skip
themselves rather than fail — a green run that silently tested less.

Run only one suite at a time against `bakbak_test`. Because Postgres is
published on host `5432`, a containerised run and a host run share that
database; concurrent runs truncate each other's fixtures and surface as
scattered foreign-key errors rather than as a conflict.
