# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress.** Still to build: CI/CD, missed-message recovery on reconnect, WebSocket and upload hardening, tracing, and calls. See [What's left](#-whats-left) below; everything that already ships is listed in [`FEATURES.md`](FEATURES.md).

---

## 🧱 Tech Stack

| Layer         | Tech                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Runtime       | [Bun](https://bun.sh) (monorepo workspaces)                                                                         |
| Backend       | Express 5 + TypeScript, Socket.IO (presence, typing, receipts, live delivery), Web Push (VAPID)                     |
| Database      | PostgreSQL + Prisma ORM (driver adapter `@prisma/adapter-pg`)                                                       |
| Redis         | ioredis — token-bucket rate limiting, Socket.IO adapter + presence, JSON cache                                      |
| Storage       | S3-compatible object storage (MinIO locally)                                                                        |
| Validation    | Shared Zod contracts (`@bakbak/contracts`) — validates requests **and** responses                                   |
| Auth          | JWT access tokens + Argon2id password hashing; email verification, password reset & email-OTP two-factor via Resend |
| Frontend      | React 19 + Vite + React Router, Tailwind CSS v4, React Compiler, `emoji-picker-react`, service worker for push      |
| Observability | pino structured logs (optional Loki shipping), `prom-client` metrics, Prometheus + Grafana + Loki stack             |
| Testing       | `bun:test` — HTTP integration tests + unit tests                                                                    |
| Tooling       | oxlint, Prettier, TypeScript                                                                                        |

## 📁 Monorepo Structure

```
bakbak/
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
└── infra/            # Postgres/MinIO/Redis + Prometheus/Loki/Grafana compose, Dockerfiles, AWS guide
```

Each backend module follows the same layered flow:

```
routes → validate(zod contract) → controller → service → repository (Prisma)
```

Services own business rules and authorization; controllers only translate HTTP ↔ contracts (reading the validated `req.valid`); every response payload is validated against its Zod contract before leaving the server.

## 🚀 Getting Started

**Prerequisites:** Bun ≥ 1.2, Docker (for the local stack: Postgres, MinIO, Redis, observability)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment — one .env at the repo root
cp .env.example .env      # fill in JWT_SECRET, RESEND_API_KEY, PRODUCTION_DB_URL
                          # and VAPID_* keys for web push (`bunx web-push generate-vapid-keys`)

# 3. Start the full local stack — Postgres + MinIO + Redis + Prometheus
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

## 🚧 What's left

> Everything already built is in [`FEATURES.md`](FEATURES.md). Module-level detail for the open items lives in [`apps/api/src/websocket/checklist.md`](apps/api/src/websocket/checklist.md) and [`apps/api/src/uploads/checklist.md`](apps/api/src/uploads/checklist.md).

- **CI/CD** — no pipeline yet (lint + typecheck + tests on PR, then deploy). When adding it, stamp the same `APP_VERSION` (git tag or commit SHA) into the API env and the web build (`VITE_APP_VERSION`) so the in-app update check stays honest.
- **Missed-message recovery** — a client that disconnects doesn't catch up on events sent while it was away; there are no event ids, ordering guarantees, or ack + retry.
- **WebSocket hardening**
  - A socket stays authenticated after its access token expires (auth runs once at the handshake; revoked sessions are still force-disconnected).
  - The `typing` event broadcasts without checking chat membership.
  - No per-user connection limits, no rate limit on `chat:join`, no backpressure handling, no delivery receipts (read receipts only).
  - WebSocket tests cover chat-room membership only (join on create/re-open, leave on remove/leave); typing, presence events and receipts are untested.
- **Upload hardening**
  - MIME type is trusted from the client (no magic-byte sniffing); `image/svg+xml` and `text/*` are accepted.
  - Original file names are stored and returned verbatim.
  - No virus scanning, per-user quota, or orphan cleanup; files are buffered whole in memory; storage errors aren't retried.
  - No thumbnails or width/height/duration extraction.
- **Rate limiting during Redis reconnects** — the server waits for Redis before it starts listening, but if Redis drops later the limiter fails open until it reconnects. Bucket sizes are dev-scale defaults, not per-environment.
- **Notifications** — web push and in-app toasts ship; there's no persisted in-app notification center or email notifications, and a subscription the browser rotates on its own isn't re-registered until the app is next opened.
- **Messages** — forwarding and pinning.
- **Group admin** — promote/demote members and transfer ownership.
- **Observability** — no distributed tracing; `/metrics` is unauthenticated and served on the public API port.
- **Calls** — the Calls tab is a placeholder.

### 🗺 Roadmap

1. CI (lint + typecheck + tests on PR), then a deploy job for Vercel or AWS
2. Missed-message recovery on reconnect (event ids + catch-up)
3. WebSocket hardening + a socket test suite
4. Upload hardening — content sniffing, SVG/`text/*` policy, file-name escaping, quotas, orphan cleanup
5. Rate-limit fallback while Redis reconnects; per-environment bucket sizes
6. Tracing, and locking down `/metrics`
7. Message forwarding & pinning; group admin roles and ownership transfer
8. Calls (WebRTC) — stretch

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
