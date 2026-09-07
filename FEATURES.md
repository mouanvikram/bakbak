# ✅ BakBak — Implemented Features

Everything marked below is **implemented, tested, and wired end-to-end** across the API, the Socket.IO realtime layer, and the web client. Items are grouped by area; each check is one self-contained capability. The per-module engineering checklists (with pending work) live under `apps/api/src/*/checklist.md`. New shipped capabilities are added here under their group heading as they land.

---

## 🔐 Auth

- [x] **Registration & email verification** — signup (optional avatar) persists the account atomically, then emails a 256-bit one-time verification link; resend returns a generic response whether or not the account exists (no account enumeration).
- [x] **Secure credentials** — Argon2id password hashing; all opaque tokens are SHA-256-hashed at rest; verification/reset tokens travel only in POST bodies and are redacted from every log line.
- [x] **Enumeration-resistant login** — username-or-email with identifier normalization, dummy-hash timing parity for unknown accounts, and a per-account brute-force lockout (5 tries / 15 min, enforced atomically). No password-complexity rules on login, so a "weak" guess can't be told apart from a wrong-but-strong one.
- [x] **Hardened password recovery** — forgot/reset uses single-use 256-bit tokens; reset is refused (same generic error) for unverified or soft-deleted accounts — no oracle.
- [x] **Password change & reset revoke every session** — all sessions are revoked and their sockets force-disconnected; old access and refresh tokens stop working (covered by tests for change-password, reset, and account deletion).
- [x] **Security alert emails** — the owner is notified on password change/reset and on every brand-new device login; token rotation is deliberately silent.

## 🔁 Sessions & Refresh Tokens

- [x] **Session-scoped JWTs** — 15-min access tokens carry a stable `sid` that is verified against a live `Session` row on every request (HTTP + WebSocket); revoked, logged-out, and deleted sessions yield one uniform `401`.
- [x] **Rotating refresh tokens** — opaque, hashed, 7-day refresh tokens; each use mints a new pair, and replay of a revoked token revokes **all** of the account's sessions (reuse detection).
- [x] **Full device management** — list active sessions (browser, first-seen, current flag), end one session, end all others, or sign out everywhere; logout ends only the caller's session.

## ✌️ Two-Factor Authentication (email OTP)

- [x] **Verified setup** — enabling 2FA requires confirming a 6-digit code emailed to the account; once on, every login pauses after the password check.
- [x] **Login challenge** — a fresh code per attempt with resend; single-use, hashed, 10-minute TTL, replaced on resend; 10 wrong codes trigger a 4-hour lockout.
- [x] **Password-protected disable** — turning 2FA off re-proves the account password, so a stolen session can't downgrade the account.
- [x] **`typ` claim separation** — 2FA challenge tokens can never be spent as access tokens.

## 👥 Users

- [x] **Profiles** — read/update your own profile, editable username with live availability check + race handling, normalized bios, title-cased names.
- [x] **Avatars** — upload (incl. at signup) and URL-set; one at a time; previous object removed; signed URLs served on every read.
- [x] **Account deletion** — soft-delete (row retained, identifying fields intact), requires a verified email, revokes all sessions + sockets.
- [x] **Search & public profiles** — capped username/first/last-name search; public profile reports the caller's live relationship status; soft-deleted accounts are treated as non-existent everywhere.

## 🤝 Friends

- [x] **Requests** — send / cancel / accept / reject with state-and-role guards; accept re-checks PENDING inside its transaction; self-, duplicate, and reverse-pending requests are rejected.
- [x] **Friendships & suggestions** — normalized pair-key storage, mutual friend list, incoming/outgoing pending lists, and suggestions that exclude friends, pending, and self.

## 💬 Chats

- [x] **Direct chats** — idempotent creation via a unique pair key.
- [x] **Group chats** — create (3+ members), name/description/avatar, admin controls, add/remove members, self-leave.
- [x] **Per-member preferences** — mute / pin / archive, and "delete for me" (leave) that hides the chat without destroying it for others.
- [x] **Authorization in the service layer** — active-participant and group-admin checks on every action, enforced server-side.

## 💬 Messages

- [x] **Send** — text or attachment messages (image / video / audio / document) with the type derived from the file; **idempotent via client `clientId`** (retries return the original; cross-chat reuse → 409), enforced by a unique index.
- [x] **Read state** — cursor pagination (capped), unread counts, mark-as-read with broadcast read receipts; live fan-out of new / edited / deleted / read events.
- [x] **Edit & soft delete** — own messages only; edits stamped; deletes serialize as `deleted`.
- [x] **Search** — case-insensitive, paginated, participation-scoped.

## ⚡ Realtime (Socket.IO)

- [x] **Authenticated gateway** — JWT handshake (Bearer or `auth.token`) with live-session verification; auto-joins the user's active chats.
- [x] **Presence & typing** — per-room presence snapshots on join, online/offline transitions persisted, throttled typing indicators.
- [x] **Live delivery** — messages, edits, deletes, read receipts, and chat/metadata changes pushed to rooms; sockets are force-disconnected on logout, session revoke, and password change.

## 🖼 Media & Uploads

- [x] **Scoped uploads** — authenticated, size + MIME limits, storage keys namespaced per uploader.
- [x] **Signed-URL access control** — active chat members (attached) or the owner (unattached); attachments on deleted messages are treated as gone; delete is owner-only.
- [x] **S3-compatible storage** — vendor-neutral provider, configurable signed-URL TTLs and CDN public URL, legacy avatar URLs pass through.

## ✉️ Email

- [x] **Transactional sends via Resend** — verification, password reset, 2FA code, password-changed, and new-device alerts through one `sendEmail` choke point.
- [x] **Test & non-prod safety** — real sends are impossible in tests (triple isolation) and all non-production mail is redirected to a hardcoded inbox.
- [x] **Atomic token flows** — `markVerifiedAndClearTokens` / `resetPasswordAndClearToken` change state and delete the token in one transaction; at most one live token per (user, type); tokens hashed by the caller.

## 🗄 Settings

- [x] **Per-account preferences** — notifications, appearance (theme, font size), and chat (enter-to-send, media preview) sections; lazily created rows, per-section partial updates.

## 🛡 Infrastructure & Security

- [x] **Layered API** — routes → Zod validation → controller → service → repository; shared `@bakbak/contracts` validate every request and every response before it leaves the server.
- [x] **Typed errors** — `AppError` with stable machine codes; a single error handler leaks no stack traces or Prisma internals.
- [x] **Request hygiene** — pino structured logs with request/correlation IDs, token redaction, body-size cap, Helmet headers, CORS allowlist, gzip.
- [x] **Global rate limiting** — fixed-window per IP+path with `429` + `Retry-After`, background pruning, shutdown hook.
- [x] **Graceful shutdown** — drains HTTP, closes Socket.IO, stops timers, disconnects Prisma, stops rate-limiter cleanup.
- [x] **Soft-delete discipline** — `deletedAt`-filtered lookups across auth, refresh, verification, reset, WebSocket, and search.

## 🧪 Testing

- [x] **269-test HTTP integration suite** — `bun:test` against a throwaway Postgres (`DEV_DB_TEST_URL`), covering auth, sessions, 2FA, users, friends, chats, messages, uploads, and settings — including the negatives: revoked/stale tokens, idempotent resends, authorization failures, and verification gates.