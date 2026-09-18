# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress.** Still to build: missed-message recovery on reconnect, WebSocket and upload hardening, tracing, and calls. See [What's left](#-whats-left) below; everything that already ships is listed in [`FEATURES.md`](FEATURES.md).

---

## 🧱 Tech Stack

| Layer         | Tech                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Runtime       | [Bun](https://bun.sh) (monorepo workspaces)                                                                         |
| Backend       | Express 5 + TypeScript, Socket.IO (presence, typing, receipts, live delivery), Web Push (VAPID)                     |
| Database      | PostgreSQL + Prisma ORM (driver adapter `@prisma/adapter-pg`)                                                       |
| Redis         | ioredis — token-bucket rate limiting, Socket.IO adapter + presence, JSON cache                                      |
| Storage       | S3-compatible object storage (SeaweedFS locally)                                                                    |
| Validation    | Shared Zod contracts (`@bakbak/contracts`) — validates requests **and** responses                                   |
| Auth          | JWT access tokens + Argon2id password hashing; email verification, password reset & email-OTP two-factor via Resend |
| Frontend      | React 19 + Vite + React Router, Tailwind CSS v4, React Compiler, `emoji-picker-react`, service worker for push      |
| Observability | pino structured logs (optional Loki shipping), `prom-client` metrics, Prometheus + Grafana + Loki stack             |
| Testing       | `bun:test` — HTTP integration tests + unit tests                                                                    |
| Tooling       | oxlint, Prettier, TypeScript                                                                                        |
| CI/CD         | GitHub Actions — lint + typecheck + integration tests on every PR; API image published to GHCR on `main`         |

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
│   │       ├── push/         # web-push subscriptions + message notifications
│   │       ├── uploads/      # attachment storage + presigned URLs
│   │       ├── settings/     # notification / appearance / chat preferences
│   │       ├── email/        # Resend templates (verify, reset, 2FA, recovery, alerts)
│   │       ├── websocket/    # Socket.IO auth, connection handling, emitter
│   │       ├── redis/        # client, rate limiter, cache, presence + Socket.IO adapter
│   │       ├── jobs/         # background job registry + periodic jobs
│   │       ├── system/       # /healthz, /readyz, /metrics, version
│   │       ├── shutdown/     # graceful-shutdown hook registry
│   │       ├── middleware/   # auth, validation, request id/logging, error handler
│   │       ├── config/       # typed env parsing
│   │       └── lib/          # logger, pagination, date helpers
│   └── web/          # React SPA (auth pages, app shell, chat, friends, settings) + push service worker
├── packages/
│   ├── contracts/    # shared Zod schemas + inferred types (API ↔ client)
│   └── db/           # Prisma schema, migrations, generated client
└── infra/            # Postgres/SeaweedFS/Redis + Prometheus/Loki/Grafana compose, Dockerfiles
```

Each backend module follows the same layered flow:

```
routes → validate(zod contract) → controller → service → repository (Prisma)
```

Services own business rules and authorization; controllers only translate HTTP ↔ contracts (reading the validated `req.valid`); every response payload is validated against its Zod contract before leaving the server.

## 🚀 Getting Started

**Prerequisites:** Bun ≥ 1.2, Docker (for the local stack: Postgres, SeaweedFS, Redis, observability)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment — one .env at the repo root
cp .env.example .env      # fill in JWT_SECRET, RESEND_API_KEY, PRODUCTION_DB_URL
                          # and VAPID_* keys for web push (`bunx web-push generate-vapid-keys`)

# 3. Start the full local stack — Postgres + SeaweedFS + Redis + Prometheus
#    (:9090), Loki (:3100) and Grafana (:3001) — then migrate the dev DB.
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

## 🤖 CI/CD

Continuous integration and a first deployment stage run on GitHub Actions (`.github/workflows`).

- **CI (`ci.yml`)** — on every PR and non-main push: `bun install --frozen-lockfile` (Bun 1.3, the same major the `infra/` Dockerfiles ship), Prisma generate → validate → `migrate:deploy` on a throwaway test database, oxlint for API + web, API typecheck, the full HTTP + Socket.IO integration suite against Postgres / Redis / SeaweedFS service containers (the uploads bucket stays private — unsigned and wrong-keyed accesses are denied), then a production web build. Builds are stamped with a commit-derived `APP_VERSION` (injected as `VITE_APP_VERSION` for the web) so the in-app update check compares honest versions.
- **Deploy (`deploy.yml`)** — on push to `main` it runs CI first as a gate, then builds `infra/Dockerfile.prod` and publishes the API image to GHCR (`ghcr.io/<owner>/bakbak-api`, tagged `latest` and the short SHA) with `APP_VERSION` / `GIT_COMMIT` / `BUILD_TIME` baked in. Rolling that image out (ECS or Vercel) is the next step.

## 🚧 What's left

> Everything already built is in [`FEATURES.md`](FEATURES.md). The list below is the known gaps; the roadmap after it is the order they're meant to be closed in.

- **Deploy roll-out** — the API image already auto-publishes to GHCR on `main`; nothing runs it yet. Wire up ECS or Vercel.
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
- **Observability** — no distributed tracing; `/metrics` is unauthenticated and served on the public API port.
- **Calls** — the Calls tab is a placeholder.

### 🗺 Roadmap

1. Roll out the published API image — CI/CD ships it to GHCR on `main`; wire ECS or Vercel to actually run it
2. Missed-message recovery on reconnect (event ids + catch-up)
3. WebSocket hardening + a socket test suite
4. Upload hardening — file-name escaping, virus scanning, thumbnails, and streaming uploads instead of whole-file buffering
5. Tracing, and locking down `/metrics`
6. Calls (WebRTC) — stretch

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
