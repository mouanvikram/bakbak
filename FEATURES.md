# ✅ BakBak — Implemented Features

Everything marked below is **implemented, tested, and wired end-to-end** across the API, the Socket.IO realtime layer, and the web client. Items are grouped by area; each check is one self-contained capability. Remaining work is listed under [What's left](README.md#-whats-left) in the README, with module detail in `apps/api/src/websocket/checklist.md` and `apps/api/src/uploads/checklist.md`. New shipped capabilities are added here under their group heading as they land.

---

## 🔐 Auth

- [x] **Registration & email verification** — signup (optional avatar, persisted atomically once valid), 256-bit one-time verification email; resend returns a generic response whether or not the account exists (no enumeration).
- [x] **Secure credential storage** — Argon2id password hashing; refresh/verification/reset tokens and 2FA codes stored only as SHA-256 hashes (256-bit entropy); tokens travel in POST bodies, never URLs, and are redacted from every log line.
- [x] **Enumeration-resistant login** — username-or-email with normalization, dummy-hash timing parity for unknown accounts, per-account brute-force lockout (5 tries / 15 min, enforced atomically) with a uniform `429` for right and wrong passwords; no complexity rules on the login password; `EMAIL_NOT_VERIFIED` surfaces only after a correct password.
- [x] **Hardened password recovery** — forgot/reset via single-use tokens; unverified or soft-deleted accounts get the same generic responses as non-existent ones (no token minted, no email, no oracle).
- [x] **Password change & reset revoke every session** — change requires the current password + a verified email; all sessions revoked, sockets force-disconnected; stale access and refresh tokens stop working (tested for change, reset, and account deletion).
- [x] **Re-auth by construction** — 2FA disable re-proves the account password; **account deletion re-proves the current password and, when 2FA is on, a freshly-emailed 2FA code** (`POST /users/me/delete-challenge` pre-checks the password and mints the code; the code is single-use). Email is read-only in this API version (change deferred to a future version).
- [x] **Security alert emails** — owner notified on password change/reset and on every brand-new device login; token rotation deliberately silent; best-effort, never blocks the action.
- [x] **30-day account recovery & post-window anonymization** — deleting the account emails a deletion notice + a recovery link (single-use, hashed, expiry anchored to `deletedAt + 30 days`; resends never extend the window); `POST /auth/recover-account` resends, `POST /auth/recover-account/verify` restores the account; generic responses keep live and deleted accounts indistinguishable. A **correct** login against a soft-deleted account still fails with no tokens, but resolves to a dedicated deleted-account response (deletion time + remaining window) that routes the web client to its account-deleted page; once the window lapses, a background job (`jobs/anonymize-deleted-users`) scrubs the row — email/username/hash replaced, profile zeroed, sessions + tokens deleted.

## 🔁 Sessions & Refresh Tokens

- [x] **Session-scoped JWTs** — 15-min access tokens carry a stable `sid` that is verified against a live `Session` row on every request (HTTP + WebSocket); revoked, logged-out, and deleted sessions yield one uniform `401`.
- [x] **Rotating refresh tokens** — opaque, hashed, 7-day refresh tokens delivered only as an **httpOnly cookie** (`SameSite=Strict`, scoped to `/api/v1/auth`, `Origin`-checked) — never in a response body or browser storage; the access token lives in memory. Each use atomically claims the token and mints a new pair, so concurrent refreshes rotate it exactly once; a replay inside a 30-second grace window is refused without side effects (multi-tab / lost-response races), and a replay after it revokes **all** of the account's sessions (reuse detection). Web refreshes are serialised across tabs with the Web Locks API.
- [x] **Full device management** — list active sessions (browser, first-seen, current flag), end one session, end all others, or sign out everywhere; logout ends only the caller's session.

## ✌️ Two-Factor Authentication (email OTP)

- [x] **Verified setup** — enabling 2FA requires confirming a 6-digit code emailed to the account; once on, every login pauses after the password check.
- [x] **Login challenge** — a fresh code per attempt with resend; single-use, hashed, 10-minute TTL, replaced on resend; 10 wrong codes trigger a 4-hour lockout.
- [x] **Password-protected disable** — turning 2FA off re-proves the account password, so a stolen session can't downgrade the account.
- [x] **`typ` claim separation** — 2FA challenge tokens can never be spent as access tokens.

## 👥 Users

- [x] **Profiles** — read/update your own profile, editable username with live availability check + race handling and a 6-month change cooldown, normalized bios, title-cased names. **Usernames are ASCII-only** (`a–z 0–9 .`) and profanity-screened; display names and bios are NFKC-normalised, reject hidden control/format chars (zero-width spaces, bidi overrides), and are screened by an obscenity guard that defeats leetspeak, lookalike letters, and stretched text (first/last names keep full Unicode and are deliberately not screened).
- [x] **Avatars** — upload (incl. at signup) and URL-set; one at a time; previous object removed; signed URLs served on every read.
- [x] **Account deletion & recovery** — soft-delete (row retained, identifying fields intact), requires a verified email + the current password (plus a fresh 2FA code when enabled), revokes all sessions + sockets, then emails a 30-day recovery link; resend and verify endpoints restore the account before the window lapses; a **login with correct credentials on a deleted account returns a deleted-account signal** (routed to the web's account-deleted page), and the row is **anonymized by a background job once the window lapses**.
- [x] **Search & public profiles** — capped username/first/last-name search; public profile reports the caller's live relationship status; soft-deleted accounts are treated as non-existent everywhere.

## 🤝 Friends

- [x] **Requests** — send / cancel / accept / reject with state-and-role guards; accept re-checks PENDING inside its transaction; self-, duplicate, and reverse-pending requests are rejected.
- [x] **Friendships & suggestions** — normalized pair-key storage, mutual friend list, incoming/outgoing pending lists, and suggestions that exclude friends, pending, and self.

## 💬 Chats

- [x] **Direct chats** — idempotent creation via a unique pair key.
- [x] **Group chats** — create (3+ members), name/description/avatar, admin controls, add/remove members, self-leave.
- [x] **Group size cap** — maximum of 1,000 members (up to 780 at creation to fit the 32 KB API request body), enforced at creation and on every add.
- [x] **Per-member preferences** — mute / pin / archive, and "delete for me" (leave) that hides the chat without destroying it for others.
- [x] **Authorization in the service layer** — active-participant and group-admin checks on every action, enforced server-side.

## 💬 Messages

- [x] **Send** — text or attachment messages (image / video / audio / document) with the type derived from the file; **idempotent via client `clientId`** (retries return the original; cross-chat reuse → 409), enforced by a unique index.
- [x] **Read state** — cursor pagination (capped), unread counts, mark-as-read with broadcast read receipts; live fan-out of new / edited / deleted / read events.
- [x] **Edit & soft delete** — own messages only; edits stamped; deletes serialize as `deleted`.
- [x] **Search** — case-insensitive, paginated, participation-scoped.
- [x] **Replies** — reply to any message; the quoted original travels with the reply, and the web client jumps to and highlights it on click.
- [x] **Reactions** — toggle an emoji on a message (add, or remove if already yours) with live `message:reaction` fan-out to the chat.

## ⚡ Realtime (Socket.IO)

- [x] **Authenticated gateway** — JWT handshake (Bearer or `auth.token`) with live-session verification; auto-joins the user's active chats.
- [x] **Presence & typing** — per-room presence snapshots on join, online/offline transitions persisted, throttled typing indicators.
- [x] **Live delivery** — messages, edits, deletes, reactions, read receipts, and chat/metadata changes pushed to rooms; sockets are force-disconnected on logout, session revoke, and password change.
- [x] **Horizontal scaling** — Socket.IO Redis adapter, so events reach sockets on any API instance; presence is tracked in Redis with per-socket leases refreshed by a heartbeat, falling back to an in-process mirror while Redis is unavailable.

## 🔔 Notifications

- [x] **Web push** — per-device VAPID subscriptions; every new message pushes to the other participants who have Messages on, even with the app or tab closed. Dead endpoints (404/410) are pruned automatically, and no OS popup is shown while a BakBak tab is focused.
- [x] **Push presentation** — the service worker draws the icon (sender's avatar with a BakBak badge, or their initial) and a click opens the conversation.
- [x] **In-app toasts** — messages landing in a chat you aren't viewing show a toast with the sender's avatar (group photo as a badge), auto-dismiss after 5 s, and open the chat on click.
- [x] **Preferences honoured** — the Messages toggle controls both push and in-app toasts (server-side recipient filter + per-browser subscription); the Sounds toggle mutes interface sounds.

## 🖼 Media & Uploads

- [x] **Scoped uploads** — authenticated, size + MIME limits, storage keys namespaced per uploader.
- [x] **Signed-URL access control** — active chat members (attached) or the owner (unattached); attachments on deleted messages are treated as gone; delete is owner-only.
- [x] **S3-compatible storage** — vendor-neutral provider, configurable signed-URL TTLs and CDN public URL, legacy avatar URLs pass through.

## ✉️ Email

- [x] **Transactional sends via Resend** — verification, password reset, 2FA code, account deletion/recovery, password-changed, and new-device alerts through one `sendEmail` choke point.
- [x] **Test & non-prod safety** — real sends are impossible in tests (triple isolation) and all non-production mail is redirected to a hardcoded inbox.
- [x] **Atomic token flows** — `markVerifiedAndClearTokens` / `resetPasswordAndClearToken` change state and delete the token in one transaction; at most one live token per (user, type); tokens hashed by the caller.

## 🗄 Settings

- [x] **Per-account preferences** — notifications (messages, sounds), appearance (theme, font size), and chat (enter-to-send, media preview) sections; lazily created rows, per-section partial updates.

## 🖥 Web client

- [x] **Interface sounds** — original, synthesized sounds for sending, receiving, typing, reactions, friend actions, dialogs, and switches, played through the Web Audio API and muted by the Sounds setting.
- [x] **Motion** — entrance animations for arriving messages, menus, dialogs, and toasts; every animation respects `prefers-reduced-motion`.

## 🛡 Infrastructure & Security

- [x] **Layered API** — routes → Zod validation → controller → service → repository; shared `@bakbak/contracts` validate every request and every response before it leaves the server.
- [x] **Typed errors** — `AppError` with stable machine codes; a single error handler leaks no stack traces or Prisma internals.
- [x] **Request hygiene** — pino structured logs with request/correlation IDs, token redaction, body-size cap, Helmet headers, CORS allowlist, gzip.
- [x] **Redis token-bucket rate limiting** — a per-IP **global** ceiling (200/4s) in `app.ts` plus dedicated buckets per abuse surface (`login`, `emails`, `uploads`, `messageSend`, `usernameCheck`, `friendRequest`, `chat`, per-user 2FA email), one atomic Lua consume via `EVALSHA`, authoritative Redis-time refills, fail-open when Redis is down (the HTTP listener waits for Redis to be ready at startup, so boot never serves unthrottled traffic), and `RateLimit-Limit`/`Remaining`/`Reset` + `Retry-After` headers. The old in-memory fixed-window limiter (`rate-limiter.middleware.ts`) is archived and unmounted.
- [x] **Redis readiness + cache module** — readiness-gated, fail-open JSON cache that clears its namespace after a Redis reconnect so invalidations missed during an outage never serve stale data (`getJson`/`setJson`/`invalidate`/`invalidatePattern`/`cacheAside` with a stampede guard) under a `cache:` prefix; wired into the friends list (5 min) and friend suggestions (60 s), invalidated on friendship changes and on friends' profile edits.
- [x] **Graceful shutdown** — drains HTTP, closes Socket.IO, stops timers, disconnects Prisma, and quits Redis (`closeRedisClient()` → `quit()` then `disconnect()` fallback).
- [x] **Soft-delete discipline** — `deletedAt`-filtered lookups across auth, refresh, verification, reset, WebSocket, and search.

## 🧪 Testing

- [x] **377-test API suite** — `bun:test` HTTP integration tests across 19 files against a throwaway Postgres (`DEV_DB_TEST_URL`), covering auth, sessions, 2FA, users, friends (including cache freshness), chats, messages, uploads, settings, and web push, plus cache behaviour across a Redis reconnect — including the negatives: revoked/stale tokens, idempotent resends, authorization failures, verification gates, username-change cooldown, the account-recovery round trip, and the password + 2FA re-auth that guards account deletion — plus unit tests for config parsing, the logger, pagination/date helpers, health/readiness probes, Prometheus metrics, and the Prisma error mapping. Contract-level profiles/moderated-field rules are covered by 22 unit tests in `packages/contracts`.
