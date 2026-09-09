# infra

Local infrastructure for development and testing: a Postgres instance with a
**dev** database and a throwaway **test** database, plus a MinIO bucket for
uploads. Nothing here is used in production.

## Databases

`@bakbak/db` chooses the connection string by `NODE_ENV`:

| `NODE_ENV`      | variable            | database                               |
| --------------- | ------------------- | -------------------------------------- |
| `production`    | `PRODUCTION_DB_URL` | your managed/hosted Postgres           |
| `test`          | `DEV_DB_TEST_URL`   | `bakbak_test` (truncated by the suite) |
| _anything else_ | `DEV_DB_URL`        | `bakbak_dev`                           |

Set `DATABASE_URL` to override all three (one-off scripts, hosts that only
inject one variable).

## Bring the infra up

```bash
docker compose -f infra/docker-compose.yml up -d          # postgres + minio
bun --cwd packages/db exec prisma migrate deploy          # migrate bakbak_dev
```

`bun run dev` then talks to the local stack. Stop it with:

```bash
docker compose -f infra/docker-compose.yml down           # add -v to wipe data
```

Ports: Postgres `5432`, MinIO API `9000`, MinIO console `9001`
(`minioadmin` / `minioadmin`).

## Run the tests in a container

```bash
docker compose -f infra/docker-compose.yml --profile test run --rm tests
```

This builds `infra/Dockerfile`, waits for Postgres, runs
`prisma migrate deploy` against `bakbak_test`, then the API suite. The suite
truncates every table between cases, so it must never point at `bakbak_dev`
or `PRODUCTION_DB_URL` — `NODE_ENV=test` guarantees `DEV_DB_TEST_URL`.

To run the suite on the host instead (against the same containers):

```bash
docker compose -f infra/docker-compose.yml up -d postgres minio minio-init
NODE_ENV=test bun --cwd packages/db exec prisma migrate deploy
bun --cwd apps/api run test
```
