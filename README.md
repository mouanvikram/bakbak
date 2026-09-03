# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress — single-instance only.** The backend core (auth, users, friends, chats, messages), the Socket.IO realtime layer, media/avatar uploads, and the React client are all implemented and wired end-to-end (~190 HTTP integration tests). Not yet built: horizontal scaling (no Socket.IO Redis adapter — realtime assumes one process), notifications, message reactions/replies, offline support, and any deployment/CI tooling. See [Status](#-current-status) below.

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh) (monorepo workspaces) |
| Backend | Express 5 + TypeScript, Socket.IO (presence, typing, receipts, live delivery) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Validation | Shared Zod contracts (`@bakbak/contracts`) — validates requests **and** responses |
| Auth | JWT access tokens + Argon2id password hashing, email verification & password reset via Resend |
| Frontend | React 19 + Vite + React Router, Tailwind CSS v4, React Compiler |
| Testing | `bun:test` — HTTP integration tests |

## 📁 Monorepo Structure

```
bakbak/
├── apps/
│   ├── api/          # Express REST API + Socket.IO server
│   │   └── src/
│   │       ├── auth/         # signup, login, verification, password flows
│   │       ├── users/        # profiles, search
│   │       ├── friends/      # requests, friendships
│   │       ├── chat/         # direct & group chats, participants
│   │       ├── messages/     # send, paginate, read state
│   │       ├── websocket/    # socket.io connection handling (WIP)
│   │       └── middleware/   # auth, validation, error handler
│   └── web/          # React SPA (auth pages, app shell, settings UI)
├── packages/
│   ├── contracts/    # shared Zod schemas + inferred types (API ↔ client)
│   └── db/           # Prisma schema, migrations, generated client
```

Each backend module follows the same layered flow:

```
routes → validate(zod contract) → controller → service → repository (Prisma)
```

Services own business rules and authorization; controllers only translate HTTP ↔ contracts; every response payload is validated against its Zod contract before leaving the server.

## 🚀 Getting Started

**Prerequisites:** Bun ≥ 1.2, Docker (for local Postgres + MinIO)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment — one .env at the repo root
cp .env.example .env      # fill in JWT_SECRET, RESEND_API_KEY, PRODUCTION_DB_URL

# 3. Start local infrastructure (Postgres + MinIO) and migrate the dev DB
bun run infra:up
bun run db:migrate

# 4. Run — API on :3000, web on :5173
bun run dev

# 5. Seed some users (password: Abcdefg@12345)
bun run db:seed

# 6. Test — runs in a container against a throwaway test database
bun run test:docker
```

`@bakbak/db` selects the connection string by `NODE_ENV`
(`DEV_DB_URL` / `DEV_DB_TEST_URL` / `PRODUCTION_DB_URL`); the test suite is
pinned to `DEV_DB_TEST_URL` so it can never truncate your dev or prod data.
See [`infra/README.md`](infra/README.md).

## 📌 Current Status

### ✅ Implemented & wired end-to-end

- **Auth** — register, login, email verification (+ resend), forgot/reset password, change password, logout, refresh-token rotation with revocation, per-account brute-force lockout. Argon2id hashing, SHA-256-hashed one-time tokens with expiry, anti-enumeration responses.
- **Users** — profile read/update, avatar upload (incl. pre-signup), user search, delete account, coarse online / last-seen state.
- **Friends** — send/accept/reject/cancel requests, friend list, suggestions, pending requests (sent/received).
- **Chats** — direct chats (idempotent via unique pair key), group chats with name/description/avatar, member management, admin controls, per-member mute/pin/archive.
- **Messages** — send text + media-type messages, cursor pagination (capped), unread counts, mark-as-read, edit, soft delete, case-insensitive search.
- **Realtime (single instance)** — authenticated Socket.IO handshake, per-chat rooms, presence, typing indicators, read receipts, live message/edit/delete fan-out, client reconnect with backoff.
- **Settings** — notification, appearance, chat preference, and privacy settings.
- **Media** — S3-compatible storage abstraction, presigned URLs, size + MIME limits.
- **Client** — full auth flow, chat list + conversation UI, friends, settings, dark mode, avatar upload.
- **Infrastructure** — typed error codes, Zod request/response validation, pino structured logging + request IDs, global rate limiter, graceful shutdown, `/healthz`.

### 🚧 Not yet built

- **Horizontal scaling** — no Socket.IO Redis adapter; presence, the rate limiter, and the pre-signup avatar buffer are all in-process, so realtime only works with a single backend instance.
- **Notifications** — no in-app / email / push notifications; the `UserSettings.notify*` toggles are stored but unused.
- **Missed-message recovery / offline support** — a client that disconnects doesn't catch up on messages sent while it was away.
- **Message features** — reactions, replies, forwarding, pinning.
- **Attachments in chat** — upload API exists; there is no send-attachment flow in the client, and `GET /uploads/:id` needs a chat-membership check.
- **Deployment** — local infra is containerized (`infra/`); no production Dockerfile, CI, or readiness wiring beyond `/healthz` yet.
- **Calls** — the Calls tab is a placeholder.

### 🗺 Roadmap

1. Isolated test database + CI (lint + typecheck + tests on PR)
2. Containerize (API + web + Postgres + MinIO) and add readiness/liveness probes
3. Redis: Socket.IO adapter + distributed rate limiter + presence (unblocks >1 instance)
4. Idempotent message send + missed-message recovery on reconnect
5. Fix attachment authorization; wire the attachment send flow in the client
6. Notifications: in-app model + socket delivery + web-push; honour the settings toggles
7. Message reactions & replies
8. `trust proxy`, explicit CSP/security headers, magic-byte MIME validation
9. Metrics (`/metrics`) + tracing
10. Group admin: promote/demote, ownership transfer; calls (WebRTC) — stretch

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
