# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress — single-instance only.** The backend core (auth, users, friends, chats, messages, attachments), the Socket.IO realtime layer, media/avatar uploads, and the React client are all implemented and wired end-to-end (303 HTTP integration tests). Not yet built: horizontal scaling (no Socket.IO Redis adapter — realtime assumes one process), notifications, message reactions/replies, offline support, and any deployment/CI tooling. See [Status](#-current-status) below and the compact, always-current feature checklist in [`FEATURES.md`](FEATURES.md).

---

## 🧱 Tech Stack

| Layer      | Tech                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Runtime    | [Bun](https://bun.sh) (monorepo workspaces)                                                                         |
| Backend    | Express 5 + TypeScript, Socket.IO (presence, typing, receipts, live delivery)                                       |
| Database   | PostgreSQL (Neon) + Prisma ORM                                                                                      |
| Validation | Shared Zod contracts (`@bakbak/contracts`) — validates requests **and** responses                                   |
| Auth       | JWT access tokens + Argon2id password hashing; email verification, password reset & email-OTP two-factor via Resend |
| Frontend   | React 19 + Vite + React Router, Tailwind CSS v4, React Compiler, `emoji-picker-react`                               |
| Testing    | `bun:test` — HTTP integration tests                                                                                 |

## 📁 Monorepo Structure

```
bakbak/
├── apps/
│   ├── api/          # Express REST API + Socket.IO server
│   │   └── src/
│   │       ├── auth/         # signup, login, verification, password, recovery & 2FA flows
│   │       ├── users/        # profiles, username, search, friendship status
│   │       ├── friends/      # requests, friendships
│   │       ├── chat/         # direct & group chats, participants, leave
│   │       ├── messages/     # send (text + attachments), paginate, read state
│   │       ├── uploads/      # attachment storage + presigned URLs
│   │       ├── settings/     # notification / appearance / chat preferences
│   │       ├── email/        # Resend templates (verify, reset, 2FA, recovery)
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

> Compact grouped checklist of everything implemented: see [`FEATURES.md`](FEATURES.md).

- **Auth** — register, login, email verification (+ resend, generic response), forgot/reset password (reset requires a **verified** email), change password, logout, refresh-token rotation with reuse detection + session revocation, per-account brute-force lockout (atomic single-statement increment, uniform `429` for right and wrong passwords). Argon2id hashing, 256-bit SHA-256-hashed one-time tokens with expiry, enumeration-independent responses (login passwords have **no complexity rules**, so a weak guess can't be told apart from a strong one). Verification/reset tokens ride in POST bodies, never the URL, and are redacted from every logged request. recovery flows treat soft-deleted accounts as non-existent (`deletedAt`-filtered lookups) **while deletion itself is revocable: `DELETE /users/me` emails a 30-day recovery link, `POST /auth/recover-account` resends it, and `POST /auth/recover-account/verify` restores the account** (tokens single-use + hashed, expiry anchored to `deletedAt`, resends never extend the window, generic responses so live and deleted accounts can't be told apart). **A correct login against a soft-deleted account resolves to a dedicated deleted-account response** — no tokens, but the deletion time + remaining recovery window — which routes the web client to its account-deleted page; and once the window lapses, a background job anonymizes the row. Every access token carries a stable **session id that is verified against a live `Session` row on every request** — revoked sessions, `sid`-less tokens, and deleted accounts all get the same `401`, so revoking a session (or logging out / deleting the account) also force-disconnects that session's live sockets. **Security alert emails** notify the owner on password change/reset and new-device logins. `JWT_SECRET` is mandatory at boot.
- **Devices / sessions** — `GET`-style listing of the account's active login sessions (device User-Agent, first seen, current flag), end one session, or end every other session. Rotated refresh tokens collapse to one entry per login.
- **Two-factor auth (email OTP)** — turning 2FA on requires confirming a 6-digit code emailed to the account; once on, every login pauses after the password check to email a fresh code and returns a short-lived challenge, exchanged for tokens via `POST /auth/login/verify-2fa` (with resend). Codes are single-use, hashed, 10-minute TTL, and repeated wrong codes trigger a 10-attempt / 4-hour lockout. **Disabling 2FA re-proves the account password** — a stolen session token alone can't downgrade the account.
- **Users** — profile read/update, **editable username with availability check, rate-limited to one change per 6 months** (email is read-only) and **ASCII-only / moderated**: usernames are restricted to `a–z 0–9 .` and profanity-screened (the obscenity guard also defeats leetspeak, lookalike letters, and stretched text); display names and bios are NFKC-normalised, reject hidden control/format chars (zero-width spaces, bidi overrides) and are profanity-screened too (first/last names stay full-Unicode and are deliberately not screened), avatar upload (incl. pre-signup), user search, delete account (recoverable within 30 days, then anonymized), coarse online / last-seen state. Bios are normalised to `null` or a real 10–500-char string. Account deletion is **soft** (session revocations + socket disconnects) and **refused until the email is verified**; deleting re-proves the **current password** and, when 2FA is on, requires the freshly-emailed 2FA code (`POST /users/me/delete-challenge` pre-checks the password and mints the code). Public profiles expose only public fields; the caller's relationship to a user is always computed from their own signed-in identity.
- **Friends** — send/accept/reject/cancel requests, friend list, suggestions, pending requests (sent/received). `GET /users/:username` reports friend count and the caller's relationship (friends / request sent / received / none).
- **Chats** — direct chats (idempotent via unique pair key), group chats with name/description/avatar, member management, admin controls, per-member mute/pin/archive, **"delete for me"** (`POST /chats/:id/leave` — hides the chat without destroying it for others), and a **contact-info panel** for direct chats (photo, bio, mutual context, add-friend action).
- **Messages** — text and **attachment messages (image / video / audio / document)** with the message type derived from the file, cursor pagination (capped), unread counts, mark-as-read, edit, soft delete, case-insensitive search. Sends are **idempotent**: the client attaches a `clientId` and a retried request returns the original message instead of a duplicate (enforced by a `(senderId, clientId)` unique index).
- **Realtime (single instance)** — authenticated Socket.IO handshake, per-chat rooms, presence, typing indicators, read receipts, live message/edit/delete fan-out, client reconnect with backoff.
- **Settings** — notification, appearance (default: light theme, small text) and chat preferences (enter-to-send, media preview — applied live in the composer and thread); 2FA is toggled only through the verified `/auth/2fa/*` endpoints. Help &amp; Support and About pages are written; the About page runs the version check.
- **Media** — S3-compatible storage abstraction, presigned URLs, size + MIME limits; images & videos preview inline in the thread (respecting the "media preview" chat setting), other files render as download chips. `GET /uploads/:id` checks the requester is an active member of the attachment's chat (or, for a not-yet-sent upload, its owner) before signing a URL.
- **Client** — full auth flow (incl. the 2FA code step), chat list + conversation UI, attachment upload, emoji picker, right-click context menus (delete a chat; edit/delete your own message), media message bubbles with overlaid receipts, active-session management (Devices), friends, settings, dark mode, avatar upload, typed delete-account confirmation.
- **Versioning** — the deploy version string (a git tag, else the commit SHA) is baked into both the API (`APP_VERSION` → `GET /api/v1/version`) and the web bundle (`VITE_APP_VERSION`); the About page compares them and prompts a reload when a tab is running stale cached code. Falls back to `"dev"` and disables the check for unstamped local builds.
- **Infrastructure** — typed error codes, Zod request/response validation, pino structured logging + request IDs, Redis token-bucket rate limiting (per-IP global ceiling + per-route buckets, fail-open, `RateLimit-*` headers), a Redis JSON cache module (`cacheAside`, not yet wired to routes), configurable `trust proxy`, a background-job registry (`jobs/`) running periodic tasks (e.g. anonymizing expired deleted accounts — currently the only job), graceful shutdown (drains HTTP, closes Socket.IO, stops timers and jobs, disconnects Prisma **and Redis**), `/healthz`.

### 🚧 Not yet built

- **Horizontal scaling** — the rate limiter is already distributed on Redis, but there's no Socket.IO Redis adapter; presence and the pre-signup avatar buffer are still in-process, so realtime only works with a single backend instance.
- **Notifications** — no in-app / email / push notifications; the `UserSettings.notify*` toggles are stored but unused.
- **Missed-message recovery / offline support** — a client that disconnects doesn't catch up on messages sent while it was away.
- **Message features** — reactions, replies, forwarding, pinning.
- **Deployment** — local infra is containerized (`infra/`); no CI/CD, production Dockerfile, or readiness wiring beyond `/healthz` yet. When adding CI, stamp the same `APP_VERSION` (git tag or commit SHA) into the API env and the web build (`VITE_APP_VERSION`) so the update check stays honest.
- **Calls** — the Calls tab is a placeholder.

### 🗺 Roadmap

1. Isolated test database + CI (lint + typecheck + tests on PR), then a deploy job for Vercel or AWS
2. Containerize (API + web + Postgres + MinIO) and add readiness/liveness probes
3. Redis: Socket.IO adapter + presence (the distributed rate limiter is done; a Redis auth/TLS story and a connect-window gate are the remaining hardening)
4. Missed-message recovery on reconnect
5. Notifications: in-app model + socket delivery + web-push; honour the settings toggles
6. Message reactions & replies
7. Explicit CSP/security headers, magic-byte MIME validation (`trust proxy` is done)
8. Metrics (`/metrics`) + tracing
9. Group admin: promote/demote, ownership transfer; calls (WebRTC) — stretch

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
