# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress.** Still to build: missed-message recovery on reconnect, WebSocket and upload hardening, tracing, and user blocking/reporting. See [What's left](#-whats-left) below; everything that already ships is listed in [`FEATURES.md`](FEATURES.md).
>
> 🎯 **Scope.** This is a portfolio project — built to demonstrate the engineering, not to operate a service carrying real users' data. Concerns that only earn their keep once real data is at stake (automated backups, restore drills, RPO/RTO, chaos testing) are deliberate non-goals, not oversights.

---

## 🧱 Tech Stack

| Layer         | Tech                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Runtime       | [Bun](https://bun.sh) (monorepo workspaces)                                                                         |
| Backend       | Express 5 + TypeScript, Socket.IO (presence, typing, receipts, live delivery), Web Push (VAPID)                     |
| Calls         | WebRTC — media is peer-to-peer; the API only relays the SDP/ICE handshake and mints short-lived coturn TURN credentials |
| Database      | PostgreSQL + Prisma ORM (driver adapter `@prisma/adapter-pg`)                                                       |
| Redis         | ioredis — token-bucket rate limiting, Socket.IO adapter + presence, JSON cache                                      |
| Storage       | S3-compatible object storage (SeaweedFS locally)                                                                    |
| Validation    | Shared Zod contracts (`@bakbak/contracts`) — validates requests **and** responses                                   |
| Auth          | JWT access tokens + Argon2id password hashing; email verification, password reset & email-OTP two-factor via Resend |
| Frontend      | React 19 + Vite + React Router, Tailwind CSS v4, React Compiler, `emoji-picker-react`, service worker for push      |
| Observability | pino structured logs (optional Loki shipping), `prom-client` metrics, Prometheus + Grafana + Loki stack             |
| Testing       | `bun:test` — HTTP integration tests + unit tests                                                                    |
| Tooling       | oxlint, Prettier, TypeScript                                                                                        |
| CI/CD         | GitHub Actions — lint + typecheck + integration tests on every PR; `main` auto-deploys the API to EC2 over SSH   |

## 📁 Monorepo Structure

```
bakbak/
├── .github/          # GitHub Actions — CI on PRs, deploy (image publish) on main
├── apps/
│   ├── api/          # Express REST API + Socket.IO server
│   │   └── src/
│   │       ├── auth/         # signup, login, verification, password, recovery & 2FA flows
│   │       ├── users/        # profiles, username, search, friendship status
│   │       ├── friends/      # requests, friendships, suggestions (+ cache keys/invalidation)
│   │       ├── chats/        # direct & group chats, participants, leave
│   │       ├── messages/     # send (text + attachments), replies, reactions, paginate, read state
│   │       ├── calls/        # WebRTC signalling relay, ICE/TURN credentials, call history
│   │       ├── push/         # web-push subscriptions + message notifications
│   │       ├── uploads/      # attachment storage + presigned URLs
│   │       ├── settings/     # notification / appearance / chat preferences
│   │       ├── email/        # Resend templates (verify, reset, 2FA, recovery, alerts)
│   │       ├── websocket/    # Socket.IO auth, connection handling, rooms, emitter
│   │       ├── redis/        # client, rate limiter, cache, lock, presence + Socket.IO adapter
│   │       ├── jobs/         # background job registry + periodic jobs
│   │       ├── system/       # /healthz, /readyz, /metrics, version
│   │       ├── shutdown/     # graceful-shutdown hook registry
│   │       ├── middleware/   # auth, validation, request id/logging, error handler
│   │       ├── services/     # service container (wiring/DI for the modules above)
│   │       ├── errors/       # AppError + machine error codes
│   │       ├── config/       # typed env parsing
│   │       ├── types/        # shared internal types
│   │       └── lib/          # logger, pagination, date helpers
│   └── web/          # React SPA (auth pages, app shell, chat, calls, friends, settings) + push service worker
├── packages/
│   ├── contracts/    # shared Zod schemas + inferred types (API ↔ client)
│   └── db/           # Prisma schema, migrations, generated client
└── infra/            # Postgres/SeaweedFS/Redis/coturn + Prometheus/Loki/Grafana compose, Dockerfiles
```

Each backend module follows the same layered flow:

```
routes → validate(zod contract) → controller → service → repository (Prisma)
```

Services own business rules and authorization; controllers only translate HTTP ↔ contracts (reading the validated `req.valid`); every response payload is validated against its Zod contract before leaving the server.

## 🚀 Getting Started

**Prerequisites:** Bun ≥ 1.4, Docker (for the local stack: Postgres, SeaweedFS, Redis, observability)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment — one .env at the repo root
cp .env.example .env      # fill in JWT_SECRET, RESEND_API_KEY, PRODUCTION_DB_URL
                          # and VAPID_* keys for web push (`bunx web-push generate-vapid-keys`)
                          # calls work out of the box against the local coturn;
                          # only TURN_STATIC_AUTH_SECRET is required in production

# 3. Start the full local stack — Postgres + SeaweedFS + Redis + coturn (:3478)
#    + Prometheus (:9090), Loki (:3100) and Grafana (:3001) — then migrate the dev DB.
bun run infra:up
bun run db:migrate

# 4. Run — API on :3000, web on :5173
bun run dev

# 5. Test — runs in a container against a throwaway test database
bun run test:docker
```

`@bakbak/db` selects the connection string by `NODE_ENV`
(`DEV_DB_URL` / `DEV_DB_TEST_URL` / `PRODUCTION_DB_URL`); the test suite is
pinned to `DEV_DB_TEST_URL` so it can never truncate your dev or prod data.
See [`infra/README.md`](infra/README.md).

Logging is controlled by `LOG_LEVEL`, `LOG_PRETTY=true` (pretty terminal output for local dev), and `LOKI_URL` (+ optional `LOKI_USERNAME` / `LOKI_PASSWORD`) to ship structured logs to Loki.

Calls need no configuration locally — the API defaults to the compose `coturn` and derives TURN credentials from `TURN_STATIC_AUTH_SECRET`. One caveat: coturn advertises its container IP as the relay address unless `TURN_EXTERNAL_IP` is set (and `--external-ip` uncommented in `infra/docker-compose.yml`), so **relayed** calls fail on a machine that needs them while direct (STUN) paths keep working.

## 🤖 CI/CD

Continuous integration and a first deployment stage run on GitHub Actions (`.github/workflows`).

- **CI (`ci.yml`)** — on every PR and non-main push: `bun install --frozen-lockfile` (Bun 1.4, the same major the `infra/` Dockerfiles ship), Prisma generate → validate → `migrate:deploy` on a throwaway test database, oxlint for API + web, API typecheck, the full HTTP + Socket.IO integration suite against Postgres / Redis / SeaweedFS service containers (the uploads bucket stays private — unsigned and wrong-keyed accesses are denied), then a production web build. Builds are stamped with a commit-derived `APP_VERSION` (injected as `VITE_APP_VERSION` for the web) so the in-app update check compares honest versions.
- **Deploy (`deploy.yml`)** — on push to `main` it runs CI first as a gate, then deploys the API over SSH (`appleboy/ssh-action`): fetch the exact commit CI validated (`git reset --hard "$GITHUB_SHA"`), `bun install --frozen-lockfile`, Prisma generate + `migrate:deploy` against `PRODUCTION_DB_URL` (read from the box's `.env.prod`), stamp `.env.version` with `APP_VERSION` / `GIT_COMMIT` / `BUILD_TIME`, restart the systemd unit, and smoke-test `https://<API_DOMAIN>/readyz`. The API runs under **systemd via Bun** on the EC2 host — no container step. Full host setup in [`deploy/README.md`](deploy/README.md).

## ☁️ Deployment

A single **EC2 host** runs the API under systemd via Bun, with nginx terminating TLS in front and coturn on the same box for WebRTC. Everything else is managed: **Vercel** serves the SPA (`apps/web`), **Neon** provides Postgres, **Upstash** provides Redis, **Cloudflare R2** provides S3-compatible object storage, and **Resend** sends email. `infra/` is the local dev stack only — none of it runs in production.

| Piece       | Where it runs                          | Notes                                                                |
| ----------- | -------------------------------------- | -------------------------------------------------------------------- |
| Web SPA     | Vercel                                 | static build of `apps/web`; `apps/web/vercel.json` has the SPA rewrites + CSP |
| API         | EC2, systemd via Bun                   | nginx → `127.0.0.1:3000`; auto-deployed by [`deploy.yml`](#-cicd)     |
| Postgres    | Neon (serverless)                      | `PRODUCTION_DB_URL`; pooled (`-pooler`) endpoint for the API            |
| Redis       | Upstash (managed)                      | `REDIS_URL` — rate limiting, cache, presence, Socket.IO adapter        |
| Uploads     | Cloudflare R2 (S3-compatible)          | `STORAGE_*` env; the API speaks S3 via the AWS SDK                     |
| TURN/STUN   | coturn on the same EC2 host            | media relays via TURN when a direct path can't be opened               |

Full one-time host setup — Bun install, swap, `.env.prod`, systemd unit, nginx site, security group, and the rollback recipe — lives in [`deploy/README.md`](deploy/README.md).

**Neon Postgres.** Copy the connection string (the **pooled** one from the Neon dashboard for anything long-running) into `PRODUCTION_DB_URL`; `@bakbak/db` picks it up when `NODE_ENV=production` (`src/resolve-db-url.ts`). Before first deploy, apply migrations once:

```bash
DATABASE_URL="postgresql://…pooler…neon.tech/neondb?sslmode=require" \
bun --cwd packages/db exec prisma migrate deploy
```

**EC2 (API).** The `deploy.yml` workflow handles every push to `main`: exact-commit fetch, install, Prisma generate + migrate, version stamp, systemd restart, `readyz` smoke test. The production env lives in the box's gitignored `.env.prod` (the same env surface as `.env.example`): `NODE_ENV=production`, `PRODUCTION_DB_URL`, `REDIS_URL`, `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` / `STORAGE_BUCKET`, `JWT_SECRET` (≥32 chars), `RESEND_API_KEY`, `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, `TURN_STATIC_AUTH_SECRET`, `TURN_REALM`, `FRONTEND_URL`, `CORS_ORIGINS`, and the `AUTH_COOKIE_*` trio for the cross-origin SPA (`AUTH_COOKIE_SAMESITE=none`, `AUTH_COOKIE_SECURE=true`). Secrets come from the GitHub Actions secrets (SSH key, `API_DOMAIN`) plus the secrets in `.env.prod`, which never touches the repo. `TURN_STATIC_AUTH_SECRET` is rejected at boot if left at its dev value.

**Vercel (web).** Import the GitHub repo and configure a project:
- **Root directory:** `apps/web` (framework preset Vite, output `dist`)
- **Install command:** `cd ../.. && bun install --frozen-lockfile` (resolves the `workspace:*` packages from the monorepo root)
- **Build command:** `bun run build`
- **Env:** `VITE_API_URL` → `https://api.<your-domain>` (and `VITE_APP_VERSION` from CI, so the stale-tab check compares real versions)

**coturn (calls).** Media is peer-to-peer, but peers behind symmetric NAT need a relay, so coturn runs on the EC2 host (visible on port 3478 plus the relay range `49160–49200`) with `--use-auth-secret` and the **same** `TURN_STATIC_AUTH_SECRET` as the API, `--realm` matching `TURN_REALM`, and `--external-ip` set to its public address. Point the API at it with `STUN_URLS` / `TURN_URLS`. Without one the API still answers `/calls/ice-servers` with STUN only: calls connect wherever a direct path exists and fail where a relay was required.

## 🚧 What's left

> Everything already built is in [`FEATURES.md`](FEATURES.md). The list below is the known gaps; the roadmap after it is the order they're meant to be closed in. Gaps are ranked for a portfolio project (see [Scope](#-bakbak)) — backups, DR and load testing are out of scope rather than pending.

- **Missed-message recovery** — a client that disconnects doesn't catch up on events sent while it was away; there are no event ids, ordering guarantees, or ack + retry.
- **WebSocket hardening**
  - A socket stays authenticated after its access token expires (auth runs once at the handshake; revoked sessions are still force-disconnected).
  - No per-user connection limits, no rate limit on `chat:join`, no backpressure handling, no delivery receipts (read receipts only).
  - Socket tests cover room membership (join on create/re-open, leave on remove/leave/delete) and the membership checks on `typing`, `read:receipt` and `chat:join`; presence is covered at the lease/sweep level only. The happy paths — typing reaching members, receipt fan-out, `presence:state` and heartbeats — are still untested.
- **Upload hardening**
  - Original file names are stored and returned verbatim. The storage key is a UUID, so this is a display concern rather than a path-traversal one.
  - No virus scanning; files are buffered whole in memory rather than streamed; storage errors aren't retried.
  - No thumbnails, and no duration for audio or video — extracting it needs a media probe, so the unused column was dropped rather than left permanently null.
- **Notifications** — web push and in-app toasts ship; there's no persisted in-app notification center or email notifications, and a subscription the browser rotates on its own isn't re-registered until the app is next opened.
- **Observability** — no distributed tracing; `/metrics` is bearer-token protected (`METRICS_AUTH_TOKEN`) and served on the public API port.
- **Calls** — one-to-one audio/video ships (see [`FEATURES.md`](FEATURES.md)); group calls don't. There are **no automated tests** for signalling or the browser half — the whole feature is manually verified only. A call that dies with neither side sending `call:end` leaves a `RINGING` row that's only corrected when history is read, and history is capped at 100 rows with no pagination.
- **Safety** — no user blocking and no abuse reporting; the only lever against someone you'd rather not hear from is removing the friendship.

### 🗺 Roadmap

1. A seed script for demo data, so the deployed instance can be reset to a clean, presentable state (this is the portfolio-scale answer to backups)
2. User blocking + abuse reporting
3. Missed-message recovery on reconnect (event ids + catch-up)
4. WebSocket hardening + a socket test suite, and test coverage for call signalling
5. Upload hardening — file-name escaping, virus scanning, thumbnails, and streaming uploads instead of whole-file buffering
6. Tracing — `/metrics` is behind `METRICS_AUTH_TOKEN`; add distributed traces (OpenTelemetry → Tempo, or spans shipped via the Loki logs)
7. Group calls — stretch

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
