# ✅ BakBak — Implemented Features

Everything marked below is **implemented and wired end-to-end** across the API, the Socket.IO realtime layer, and the web client — and covered by the automated suite except where a section says otherwise (today: calls). Items are grouped by area; each check is one self-contained capability. Remaining work is listed under [What's left](README.md#-whats-left) in the README. New shipped capabilities are added here under their group heading as they land.

**Scope:** a portfolio project. The bar here is demonstrating the engineering — correctness, security, and a realtime architecture that would scale — not operating a service that carries real users' data. Operational work that only earns its keep once real data is at stake (automated backups, restore drills, load testing) is deliberately out of scope.

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
- [x] **Live delivery** — messages, edits, deletes, reactions, read receipts, chat/metadata changes, and the call handshake pushed to rooms; sockets are force-disconnected on logout, session revoke, and password change.
- [x] **Horizontal scaling** — Socket.IO Redis adapter, so events reach sockets on any API instance; presence is tracked in Redis with per-socket leases refreshed by a heartbeat, falling back to an in-process mirror while Redis is unavailable. A background sweep marks users whose leases expired without a clean disconnect (e.g. their API server crashed) offline — profile `lastSeenAt` set to their last heartbeat, and their chats notified.

## 📞 Calls (WebRTC)

> One-to-one audio and video. Group calls aren't supported. This is the one area with **no automated coverage** — it's manually verified only.

- [x] **Peer-to-peer media** — the API relays the handshake (SDP offer/answer, then trickled ICE candidates) and nothing else; it never parses, stores, or forwards audio or video. Once the peers agree, media flows directly, or through TURN when a direct path can't be opened.
- [x] **Authorized signalling** — every `call:offer` / `call:answer` / `call:ice-candidate` / `call:end` is schema-parsed and gated on the sender being an **active participant** of that chat, so a stranger holding a `chatId` can't ring its members or push SDP at them mid-call; the membership check fails closed and says so in the logs.
- [x] **Ephemeral TURN credentials** — `GET /calls/ice-servers` is authenticated (unlike the public VAPID key: a TURN pair is working relay capacity) and mints coturn REST-API credentials — username `<unix-expiry>:<userId>`, password `base64(HMAC-SHA1(username, shared secret))`. coturn recomputes the same HMAC, so nothing is stored or synchronised between the two services and a leaked pair expires on its own. Long-term static credentials are deliberately unsupported. With no TURN secret configured the response degrades to STUN-only rather than failing.
- [x] **Rings every device** — the offer is broadcast to the chat room, not one socket, so a callee signed in on several devices rings on all of them.
- [x] **Busy handling** — an incoming call while already on one is refused with `BUSY` instead of ringing over the top; the caller is told they're on another call.
- [x] **Ring-out on both ends** — 45 s, with the callee's timer running 5 s longer so the caller's `call:end` normally lands first and only one side reports the outcome; the callee's is the safety net for a caller whose tab died mid-ring. A timeout is recorded as **missed** whichever end noticed, so a callee who simply wasn't there is never logged as having declined.
- [x] **Trickle-ICE candidate queueing** — candidates arriving before the remote description is set are held and flushed after, rather than thrown away — the classic cause of a call that rings, answers, then never connects.
- [x] **In-call controls** — mute the mic, toggle the camera, and a duration counted from the moment media actually connected. A voice call never opens the camera at all: no hardware indicator, no track to forget to mute.
- [x] **Call history** — a `Call` row per call (type, status, direction, peer, duration from answer to end) backing the Calls tab. Status is decided server-side rather than taken from the client, and a row left `RINGING` by a crash or lost socket reads as **missed**. History writes are best-effort throughout — a failed bookkeeping write is logged and the call carries on.
- [x] **Clean teardown** — losing the socket mid-call, a failed peer connection, or a blocked microphone tears the call down and surfaces one toast (the call UI itself unmounts, so it can't host the message); tracks are stopped so the camera/mic indicator goes out.

## 🔔 Notifications

- [x] **Web push** — per-device VAPID subscriptions; every new message pushes to the other participants who have Messages on, even with the app or tab closed. Dead endpoints (404/410) are pruned automatically, and no OS popup is shown while a BakBak tab is focused.
- [x] **Push presentation** — the service worker draws the icon (sender's avatar with a BakBak badge, or their initial) and a click opens the conversation.
- [x] **In-app toasts** — messages landing in a chat you aren't viewing show a toast with the sender's avatar (group photo as a badge), auto-dismiss after 5 s, and open the chat on click.
- [x] **Preferences honoured** — the Messages toggle controls both push and in-app toasts (server-side recipient filter + per-browser subscription); the Sounds toggle mutes interface sounds.

## 🖼 Media & Uploads

- [x] **Scoped uploads** — authenticated, storage keys namespaced per uploader, and every row records its owner.
- [x] **Size limits per kind** — 3 MB for attachments, 20 MB for video, 1 MB for avatars (signup and profile alike). Multer admits up to the largest allowance, then the buffered file is held to the cap that matches its kind; the multipart body cap is derived from the same number, so a large video is never refused before its own limit applies.
- [x] **Per-user storage quota** — 100 MB of stored attachments per account, checked before anything reaches object storage so a refused upload leaves no orphaned object. Past the ceiling only uploads stop: sending, receiving and every other action carry on, and deleting an attachment frees the space.
- [x] **Content sniffing** — the declared MIME is treated as a claim, not a fact: the bytes are checked against the kind they claim to be, so an executable posted as `image/png` is rejected. `image/svg+xml` and `text/*` are refused outright — both are script-bearing documents a browser would run in our origin.
- [x] **Signed-URL access control** — active chat members (attached) or the owner (unattached); attachments on deleted messages are treated as gone; delete is owner-only.
- [x] **S3-compatible storage** — vendor-neutral provider, configurable signed-URL TTLs and CDN public URL, legacy avatar URLs pass through.
- [x] **Per-message byte cap** — the attachments on a single message may not total more than 50 MB, so a batch of individually-legal files can't piggyback through as one oversized message; a refused send leaves nothing linked.
- [x] **Orphan cleanup** — a background job removes what nothing references any more: uploads never attached to a message, avatar rows no profile points at, and files belonging to soft-deleted messages. The object is deleted before its row, so a storage failure retries next run instead of leaking the file; the sweep runs under a Redis lock so competing API instances never select the same rows.

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
- [x] **Redis token-bucket rate limiting** — a per-IP **global** ceiling (200/4s) in `app.ts` plus dedicated buckets per abuse surface (`login`, `emails`, `uploads`, `usernameCheck`, `friendRequest`, `chat`, per-user 2FA email, and per-user `passwordChange` / `sessions` / `twoFactorManage`), one atomic Lua consume via `EVALSHA`, authoritative Redis-time refills, and `RateLimit-Limit`/`Remaining`/`Reset` + `Retry-After` headers. Login and 2FA routes **fail closed** — `503` + `Retry-After` — only when Redis is genuinely down, while the brief cold-start window before the client has ever connected is allowed through unthrottled rather than refused, so boot never serves broken traffic. The in-memory fixed-window limiter it replaced has been deleted.
- [x] **Redis readiness + cache module** — readiness-gated, fail-open JSON cache that clears its namespace after a Redis reconnect so invalidations missed during an outage never serve stale data (`getJson`/`setJson`/`invalidate`/`invalidatePattern`/`cacheAside` with a stampede guard) under a `cache:` prefix; wired into the friends list (5 min) and friend suggestions (60 s), invalidated on friendship changes and on friends' profile edits.
- [x] **Graceful shutdown** — drains HTTP, closes Socket.IO, stops timers, disconnects Prisma, and quits Redis (`closeRedisClient()` → `quit()` then `disconnect()` fallback).
- [x] **Soft-delete discipline** — `deletedAt`-filtered lookups across auth, refresh, verification, reset, WebSocket, and search.

## 🤖 CI/CD

- [x] **Continuous integration** — GitHub Actions runs on every PR and non-main push: frozen-lockfile install (Bun 1.4), Prisma generate/validate/`migrate:deploy`, oxlint for API + web, API typecheck, the full HTTP + Socket.IO integration suite against Postgres + Redis + SeaweedFS service containers (uploads bucket private — unsigned accesses denied), then a production web build.
- [x] **Version-stamped builds** — every build is stamped with a commit-derived `APP_VERSION` (`pr-<n>-<sha>` / `<branch>-<sha>` / `<sha>`), injected as `VITE_APP_VERSION` for the web client so its stale-tab update check compares real versions.
- [x] **Automated deploy** — pushing to `main` gates on CI, then deploys the API over SSH to the EC2 host: fetch the exact validated commit, `bun install --frozen-lockfile`, Prisma generate + `migrate:deploy` against production, write the `APP_VERSION` / `GIT_COMMIT` / `BUILD_TIME` stamp file, restart the systemd unit, and smoke-test `/readyz`. The API runs under systemd via Bun on the host — no container step (full setup in [`deploy/README.md`](README.md)).

## 🧪 Testing

- [x] **421-test API suite** — `bun:test` HTTP integration tests across 25 files (including real Socket.IO client tests for chat-room membership) against a throwaway Postgres (`DEV_DB_TEST_URL`), covering auth, sessions, 2FA, users, friends (including cache freshness), chats, messages, uploads, settings, web push, rate limiting (throttled 429s, fail-closed outage responses, and the orphan-cleanup lock), and cache behaviour across a Redis reconnect — including the negatives: revoked/stale tokens, idempotent resends, authorization failures, verification gates, username-change cooldown, the account-recovery round trip, and the password + 2FA re-auth that guards account deletion — plus unit tests for config parsing, the logger, pagination/date helpers, health/readiness probes, Prometheus metrics, and the Prisma error mapping. Contract-level profiles/moderated-field rules are covered by 22 unit tests in `packages/contracts`. The suite runs **serially** (`bun test --serial`) — it shares one test database, so two concurrent runs corrupt each other's fixtures and fail in ways that look like application bugs. Call signalling is the one shipped area with no automated coverage.
