# 💬 BakBak

A real-time social chat app — direct & group messaging, friends, media sharing.

> ⚠️ **Work in progress.** The backend core (auth, users, friends, chats, messages) is fully implemented and integration-tested (~112 tests). Socket.IO, media uploads, and most of the React frontend are still being built. See [Status](#-current-status) below.

---

## 🧱 Tech Stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh) (monorepo workspaces) |
| Backend | Express 5 + TypeScript, Socket.IO (wired, handlers pending) |
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

**Prerequisites:** Bun ≥ 1.2, PostgreSQL (local instance recommended)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
#    apps/api/.env        → DATABASE_URL, JWT_SECRET, PORT,
#                           CORS_ORIGINS, FRONTEND_URL, RESEND_API_KEY
#    packages/db/.env     → DATABASE_URL
cp apps/api/.env.example apps/api/.env   # fill in values

# 3. Generate Prisma client & apply migrations
cd packages/db && bunx prisma migrate dev

# 4. Run
bun run dev              # from repo root — starts API on :3000
cd apps/web && bun run dev   # frontend on :5173

# 5. Test (uses DATABASE_URL — point it at a local DB first!)
cd apps/api && bun test
```

## 📌 Current Status

### ✅ Implemented (backend)

- **Auth** — register, login, email verification (+ resend), forgot/reset password, change password, logout, refresh-token rotation with session revocation. Argon2id hashing, SHA-256-hashed one-time tokens with expiry, anti-enumeration responses.
- **Users** — profile read/update, avatar, user search, delete account.
- **Friends** — send/accept/reject/cancel requests, friend list, pending requests (sent/received).
- **Chats** — create direct chats (idempotent via unique pair key) and group chats, member management, group admin controls.
- **Messages** — send text/image messages, cursor-based pagination (capped), unread counts, mark-as-read, soft delete, case-insensitive search.
- **Settings** — notification, appearance, chat preference, and privacy settings.
- **Infrastructure** — global error handling with typed error codes, Zod request/response validation, pino logging.

### 🚧 In Progress

- Socket.IO layer: authenticated handshake, rooms, presence, live message delivery
- Media attachments (schema exists, upload pipeline pending)
- Frontend: most routes are placeholder pages; `AuthContext` and chat/friends UI are not yet wired to the API

### 🗺 Roadmap

1. Finish realtime messaging end-to-end (typing indicators, delivery/read receipts)
2. Rate limiting + security hardening pass (helmet, body limits, ownership checks audit)
3. Message features: reactions, replies, edit/delete-for-everyone, search
4. Media uploads (images, voice notes) with compression
5. Group admin features: promote admins, invite links
6. Notifications (in-app + browser push)
7. Dark mode, responsive polish, accessibility pass
8. Dockerized local dev (Postgres + API + web), CI pipeline running lint + tests
9. Calls (WebRTC) — stretch goal

<details>
<summary>Longer-term ideas</summary>

Communities/channels, stories, polls, scheduled messages, E2E encryption, desktop/mobile clients.
</details>

## 📄 License

MIT
