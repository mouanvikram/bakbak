# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress — single-instance only.** The backend core (auth, users, friends, chats, messages, attachments), the Socket.IO realtime layer, media/avatar uploads, and the React client are all implemented and wired end-to-end (~260 HTTP integration tests). Not yet built: horizontal scaling (no Socket.IO Redis adapter — realtime assumes one process), notifications, message reactions/replies, offline support, and any deployment/CI tooling. See [Status](#-current-status) below.

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh) (monorepo workspaces) |
| Backend | Express 5 + TypeScript, Socket.IO (presence, typing, receipts, live delivery) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Validation | Shared Zod contracts (`@bakbak/contracts`) — validates requests **and** responses |
| Auth | JWT access tokens + Argon2id password hashing; email verification, password reset & email-OTP two-factor via Resend |
| Frontend | React 19 + Vite + React Router, Tailwind CSS v4, React Compiler, `emoji-picker-react` |
| Testing | `bun:test` — HTTP integration tests |

## 📁 Monorepo Structure

```
bakbak/
├── apps/
│   ├── api/          # Express REST API + Socket.IO server
│   │   └── src/
│   │       ├── auth/         # signup, login, verification, password & 2FA flows
│   │       ├── users/        # profiles, username, search, friendship status
│   │       ├── friends/      # requests, friendships
│   │       ├── chat/         # direct & group chats, participants, leave
│   │       ├── messages/     # send (text + attachments), paginate, read state
│   │       ├── uploads/      # attachment storage + presigned URLs
│   │       ├── settings/     # notification / appearance / chat preferences
│   │       ├── email/        # Resend templates (verify, reset, 2FA code)
│   │       ├── websocket/    # socket.io connection handling (WIP)
│   │       └── middleware/   # auth, validation, error handler
│   └── web/          # React SPA (auth pages, app shell, chat, settings)
├── packages/
│   ├── contracts/    # shared Zod schemas + inferred types (API ↔ client)
│   └── db/           # Prisma schema, migrations, generated client
```

Each backend module follows the same layered flow:

```
routes → validate(zod contract) → controller → service → repository (Prisma)
```

Services own business rules and authorization; controllers only translate HTTP ↔ contracts (reading the validated `req.valid`); every response payload is validated against its Zod contract before leaving the server.

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

- **Auth** — register, login, email verification (+ resend, generic response), forgot/reset password, change password, logout, refresh-token rotation with reuse detection + session revocation, per-account brute-force lockout (atomic single-statement increment, uniform `429` for right and wrong passwords). Argon2id hashing, 256-bit SHA-256-hashed one-time tokens with expiry, enumeration-independent responses (login passwords have **no complexity rules**, so a weak guess can't be told apart from a strong one). Verification/reset tokens ride in POST bodies, never the URL, and are redacted from every logged request. Recovery flows treat soft-deleted accounts as non-existent (`deletedAt`-filtered lookups). Every access token carries a stable **session id that is verified against a live `Session` row on every request** — revoked sessions, `sid`-less tokens, and deleted accounts all get the same `401`, so revoking a session (or logging out / deleting the account) also force-disconnects that session's live sockets. `JWT_SECRET` is mandatory at boot.
- **Devices / sessions** — `GET`-style listing of the account's active login sessions (device User-Agent, first seen, current flag), end one session, or end every other session. Rotated refresh tokens collapse to one entry per login.
- **Two-factor auth (email OTP)** — turning 2FA on requires confirming a 6-digit code emailed to the account; once on, every login pauses after the password check to email a fresh code and returns a short-lived challenge, exchanged for tokens via `POST /auth/login/verify-2fa` (with resend). Codes are single-use, hashed, 10-minute TTL, and repeated wrong codes trigger a 10-attempt / 4-hour lockout. **Disabling 2FA re-proves the account password** — a stolen session token alone can't downgrade the account.
- **Users** — profile read/update, **editable username with availability check** (email is read-only), avatar upload (incl. pre-signup), user search, delete account, coarse online / last-seen state. Bios are normalised to `null` or a real 10–500-char string. Account deletion is **soft** (session revocations + socket disconnects) and **refused until the email is verified**. Public profiles expose only public fields; the caller's relationship to a user is always computed from their own signed-in identity.
- **Friends** — send/accept/reject/cancel requests, friend list, suggestions, pending requests (sent/received). `GET /users/:username` reports friend count and the caller's relationship (friends / request sent / received / none).
- **Chats** — direct chats (idempotent via unique pair key), group chats with name/description/avatar, member management, admin controls, per-member mute/pin/archive, **"delete for me"** (`POST /chats/:id/leave` — hides the chat without destroying it for others), and a **contact-info panel** for direct chats (photo, bio, mutual context, add-friend action).
- **Messages** — text and **attachment messages (image / video / audio / document)** with the message type derived from the file, cursor pagination (capped), unread counts, mark-as-read, edit, soft delete, case-insensitive search. Sends are **idempotent**: the client attaches a `clientId` and a retried request returns the original message instead of a duplicate (enforced by a `(senderId, clientId)` unique index).
- **Realtime (single instance)** — authenticated Socket.IO handshake, per-chat rooms, presence, typing indicators, read receipts, live message/edit/delete fan-out, client reconnect with backoff.
- **Settings** — notification, appearance (default: light theme, small text) and chat preferences (enter-to-send, media preview — applied live in the composer and thread); 2FA is toggled only through the verified `/auth/2fa/*` endpoints. Help &amp; Support and About pages are written; the About page runs the version check.
- **Media** — S3-compatible storage abstraction, presigned URLs, size + MIME limits; images & videos preview inline in the thread (respecting the "media preview" chat setting), other files render as download chips. `GET /uploads/:id` checks the requester is an active member of the attachment's chat (or, for a not-yet-sent upload, its owner) before signing a URL.
- **Client** — full auth flow (incl. the 2FA code step), chat list + conversation UI, attachment upload, emoji picker, right-click context menus (delete a chat; edit/delete your own message), media message bubbles with overlaid receipts, active-session management (Devices), friends, settings, dark mode, avatar upload, typed delete-account confirmation.
- **Versioning** — the deploy version string (a git tag, else the commit SHA) is baked into both the API (`APP_VERSION` → `GET /api/v1/version`) and the web bundle (`VITE_APP_VERSION`); the About page compares them and prompts a reload when a tab is running stale cached code. Falls back to `"dev"` and disables the check for unstamped local builds.
- **Infrastructure** — typed error codes, Zod request/response validation, pino structured logging + request IDs, global rate limiter, graceful shutdown, `/healthz`.

### 🚧 Not yet built

- **Horizontal scaling** — no Socket.IO Redis adapter; presence, the rate limiter, and the pre-signup avatar buffer are all in-process, so realtime only works with a single backend instance.
- **Notifications** — no in-app / email / push notifications; the `UserSettings.notify*` toggles are stored but unused.
- **Missed-message recovery / offline support** — a client that disconnects doesn't catch up on messages sent while it was away.
- **Message features** — reactions, replies, forwarding, pinning.
- **Deployment** — local infra is containerized (`infra/`); no CI/CD, production Dockerfile, or readiness wiring beyond `/healthz` yet. When adding CI, stamp the same `APP_VERSION` (git tag or commit SHA) into the API env and the web build (`VITE_APP_VERSION`) so the update check stays honest.
- **Calls** — the Calls tab is a placeholder.

### 🗺 Roadmap

1. Isolated test database + CI (lint + typecheck + tests on PR), then a deploy job for Vercel or AWS
2. Containerize (API + web + Postgres + MinIO) and add readiness/liveness probes
3. Redis: Socket.IO adapter + distributed rate limiter + presence (unblocks >1 instance)
4. Missed-message recovery on reconnect
5. Notifications: in-app model + socket delivery + web-push; honour the settings toggles
6. Message reactions & replies
7. `trust proxy`, explicit CSP/security headers, magic-byte MIME validation
8. Metrics (`/metrics`) + tracing
9. Group admin: promote/demote, ownership transfer; calls (WebRTC) — stretch

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
