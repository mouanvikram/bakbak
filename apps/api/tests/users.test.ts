import "./setup";
import crypto from "node:crypto";
import { mock } from "bun:test";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  test,
  expect,
  spyOn,
} from "bun:test";
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@bakbak/db";
import { emailService } from "@/services/service.container";
import {
  cleanupDatabase,
  createTestUser,
  authHeader,
  isDatabaseAvailable,
} from "./helpers";

mock.module("resend", () => ({
  Resend: class {
    emails = {
      send: mock(() =>
        Promise.resolve({ data: { id: "test-email-id" }, error: null }),
      ),
    };
  },
}));

const DB_AVAILABLE = await isDatabaseAvailable();

// Spy on the shared EmailService instance the container hands to AuthService,
// so tests can read the plaintext 2FA code (only ever sent by email).
const twoFactorEmailSpy = spyOn(
  emailService,
  "sendTwoFactorCode",
).mockResolvedValue(undefined);

/** The 6-digit code from the most recent `sendTwoFactorCode` call. */
function lastTwoFactorCode(): string {
  const calls = twoFactorEmailSpy.mock.calls;
  const args = calls[calls.length - 1]?.[0] as { code?: string } | undefined;
  if (!args?.code) throw new Error("sendTwoFactorCode was not called");
  return args.code;
}

describe.skipIf(!DB_AVAILABLE)("Users Endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    port = typeof address === "string" ? parseInt(address) : address!.port;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    await cleanupDatabase();
    testUser = await createTestUser({
      username: `user.${Date.now()}`,
      email: `user.${Date.now()}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  /** Turn on 2FA for the given user via the real setup + enable endpoints. */
  async function enableTwoFactor(user: {
    id: string;
    username: string;
  }): Promise<void> {
    const auth = await authHeader(user.id, user.username);
    const setup = await fetch(`${baseUrl()}/api/v1/auth/2fa/setup`, {
      method: "POST",
      headers: auth,
    });
    expect(setup.status).toBe(200);

    const enable = await fetch(`${baseUrl()}/api/v1/auth/2fa/enable`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ code: lastTwoFactorCode() }),
    });
    expect(enable.status).toBe(200);
  }

  const deleteWithPassword = async (password: string, twoFactorCode?: string) =>
    fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password, twoFactorCode }),
    });

  test("GET /users/me - should return current user profile with auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      headers: await authHeader(testUser.id, testUser.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.profile).toHaveProperty("id", testUser.id);
    expect(data.profile).toHaveProperty("email", testUser.email);
    expect(data.profile).toHaveProperty("username", testUser.username);
    expect(data.profile).toHaveProperty("verified", testUser.isEmailVerified);
    expect(data.profile).toHaveProperty("firstName", "Test");
    expect(data.profile).toHaveProperty("lastName", "User");
    expect(data.profile).toHaveProperty("displayName", "Test User");
    expect(data.profile).toHaveProperty("bio", "This is a test bio.");
    expect(data.profile).toHaveProperty("avatar", null);
  });

  test("GET /users/me - should fail without auth token", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`);

    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.message || data.error).toBeDefined();
  });

  test("GET /users/me - should fail with invalid auth token", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.message || data.error).toBeDefined();
  });

  test("PATCH /users/me - should update profile with auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({
        bio: "Updated bio",
        firstName: "Jane",
        lastName: "Smith",
        displayName: "Jane Smith",
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("firstName", "Jane");
    expect(data).toHaveProperty("lastName", "Smith");
    expect(data).toHaveProperty("displayName", "Jane Smith");
    expect(data).toHaveProperty("bio", "Updated bio");
  });

  test("PATCH /users/me - changes the username and it sticks", async () => {
    const newName = `renamed.${Date.now()}`;
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ username: newName }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as any).username).toBe(newName);

    const row = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(row?.username).toBe(newName);
  });

  test("PATCH /users/me - blocks a second username change within the cooldown", async () => {
    const first = `first.${Date.now()}`;
    const firstRes = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ username: first }),
    });
    expect(firstRes.status).toBe(200);

    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ username: `again.${Date.now()}` }),
    });

    expect(res.status).toBe(429);
    expect(((await res.json()) as any).error.code).toBe(
      "USERNAME_CHANGE_COOLDOWN",
    );

    const row = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(row?.username).toBe(first);
  });

  test("PATCH /users/me - re-sending the same username is a no-op, not a conflict", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ username: testUser.username, firstName: "Sam" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.username).toBe(testUser.username);
    expect(data.firstName).toBe("Sam");
  });

  test("PATCH /users/me - rejects a username already taken by someone else", async () => {
    const other = await createTestUser({
      username: `taken.${Date.now()}`,
      email: `taken.${Date.now()}@example.com`,
    });
    const fresh = await createTestUser({
      username: `fresh.${Date.now()}`,
      email: `fresh.${Date.now()}@example.com`,
    });

    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(fresh.id, fresh.username)),
      },
      body: JSON.stringify({ username: other.username }),
    });

    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error.code).toBe(
      "USERNAME_ALREADY_EXISTS",
    );

    const row = await prisma.user.findUnique({ where: { id: fresh.id } });
    expect(row?.username).toBe(fresh.username);
  });

  test("PATCH /users/me - rejects a too-short username", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ username: "ab" }),
    });
    expect(res.status).toBe(400);
  });

  test("PATCH /users/me - clearing the bio stores null, not an empty string", async () => {
    for (const bio of ["", "   "]) {
      const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(testUser.id, testUser.username)),
        },
        body: JSON.stringify({ bio }),
      });

      expect(res.status).toBe(200);
      expect(((await res.json()) as any).bio).toBeNull();

      const row = await prisma.userProfile.findUnique({
        where: { userId: testUser.id },
      });
      expect(row?.bio).toBeNull();

      // And it reads back cleanly through /users/me.
      const me = await fetch(`${baseUrl()}/api/v1/users/me`, {
        headers: await authHeader(testUser.id, testUser.username),
      });
      expect(me.status).toBe(200);
      expect(((await me.json()) as any).profile.bio).toBeNull();
    }
  });

  test("PATCH /users/me - rejects a bio shorter than 10 characters", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ bio: "hi there" }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error?.code ?? data.error).toBeDefined();
  });

  test("PATCH /users/me - trims and keeps a valid bio", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ bio: "  Loves long walks and strong coffee.  " }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as any).bio).toBe(
      "Loves long walks and strong coffee.",
    );
  });

  test("PATCH /users/me - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "Updated" }),
    });

    expect(res.status).toBe(401);
  });

  test("PATCH /users/me/avatar - should update avatar with auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me/avatar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ avatar: "https://example.com/new-avatar.png" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("avatar", "https://example.com/new-avatar.png");
  });

  test("PATCH /users/me/avatar - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me/avatar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar: "https://example.com/avatar.png" }),
    });

    expect(res.status).toBe(401);
  });

  test("DELETE /users/me - should mark the account deleted without removing it", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message).toBe("Account Deleted successfully");

    // Soft delete only: the row (and its identifying fields) stay intact.
    const user = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(user).not.toBeNull();
    expect(user?.deletedAt).not.toBeNull();
    expect(user?.email).toBe(testUser.email);
    expect(user?.username).toBe(testUser.username);
  });

  test("DELETE /users/me - unverified account cannot be deleted", async () => {
    const unverified = await createTestUser({
      email: `unver.${Date.now()}@example.com`,
      isEmailVerified: false,
    });

    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(unverified.id, unverified.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("EMAIL_NOT_VERIFIED");

    // The account is untouched by the rejected delete.
    const user = await prisma.user.findUnique({ where: { id: unverified.id } });
    expect(user?.deletedAt).toBeNull();
  });

  test("DELETE /users/me - leaves the user's sent messages untouched", async () => {
    const other = await createTestUser({
      email: `other.${Date.now()}@example.com`,
    });
    const chat = await prisma.chat.create({
      data: {
        createdById: testUser.id,
        participants: {
          create: [{ userId: testUser.id }, { userId: other.id }],
        },
      },
    });
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: testUser.id,
        clientId: crypto.randomUUID(),
        text: "hello there",
      },
    });

    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });
    expect(res.status).toBe(200);

    const updated = await prisma.message.findUnique({
      where: { id: message.id },
    });
    expect(updated?.deletedAt).toBeNull();
    expect(updated?.text).toBe("hello there");
    expect(updated?.senderId).toBe(testUser.id);
  });

  test("DELETE /users/me - a deleted account can no longer log in", async () => {
    await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });

    const login = await fetch(`${baseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: testUser.email,
        password: "TestPass123!",
      }),
    });
    // Soft-deleted account, correct password: login still fails authentication
    // but answers 200 with the deleted-account signal so the web can route the
    // owner to the recovery flow, instead of issuing tokens.
    expect(login.status).toBe(200);
    const body = (await login.json()) as { deleted?: boolean };
    expect(body.deleted).toBe(true);
  });

  test("DELETE /users/me - revokes all sessions: old access and refresh tokens stop working", async () => {
    // Sign in to get tokens bound to a real session (S1).
    const login = await fetch(`${baseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: testUser.email,
        password: "TestPass123!",
      }),
    });
    const loginData = (await login.json()) as any;

    const delRes = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });
    expect(delRes.status).toBe(200);

    // Every session row for the user is now revoked ...
    const sessions = await prisma.session.findMany({
      where: { userId: testUser.id },
    });
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.revokedAt).not.toBeNull();
    }

    // ... so the pre-delete access token is rejected with the uniform 401.
    const meRes = await fetch(`${baseUrl()}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${loginData.accessToken}` },
    });
    expect(meRes.status).toBe(401);

    // And the pre-delete refresh token can no longer rotate.
    const refreshRes = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: loginData.refreshToken }),
    });
    expect(refreshRes.status).toBe(401);
  });

  test("DELETE /users/me - creates a 30-day account recovery token", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });
    expect(res.status).toBe(200);

    const token = await prisma.verificationToken.findFirst({
      where: { userId: testUser.id, type: "ACCOUNT_RECOVERY" },
    });
    expect(token).not.toBeNull();
    // The window anchors on deletion time: roughly now + 30 days.
    const expectedEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(token!.expiresAt.getTime() - expectedEnd)).toBeLessThan(
      60 * 1000,
    );
  });

  test("POST /auth/recover-account - resends a recovery link for a deleted account", async () => {
    await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });

    const res = await fetch(`${baseUrl()}/api/v1/auth/recover-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).message).toContain("recovery");

    const token = await prisma.verificationToken.findFirst({
      where: { userId: testUser.id, type: "ACCOUNT_RECOVERY" },
    });
    expect(token).not.toBeNull();
  });

  test("POST /auth/recover-account - generic response for a live account, no token", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/auth/recover-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email }),
    });
    expect(res.status).toBe(200);

    const token = await prisma.verificationToken.findFirst({
      where: { userId: testUser.id, type: "ACCOUNT_RECOVERY" },
    });
    expect(token).toBeNull();
  });

  test("DELETE /users/me - emails the account-deletion notice and recovery link", async () => {
    const deletionSpy = spyOn(emailService, "sendAccountDeletionEmail");
    const recoverySpy = spyOn(emailService, "sendAccountRecoveryEmail");

    try {
      const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(testUser.id, testUser.username)),
        },
        body: JSON.stringify({ password: "TestPass123!" }),
      });
      expect(res.status).toBe(200);

      expect(deletionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: testUser.email,
          username: testUser.username,
        }),
      );
      expect(recoverySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: testUser.email,
          username: testUser.username,
          url: expect.stringContaining("/verify-recovery?token="),
        }),
      );
    } finally {
      deletionSpy.mockRestore();
      recoverySpy.mockRestore();
    }
  });

  test("DELETE /users/me - rejects a wrong password", async () => {
    const res = await deleteWithPassword("WrongPass123!");

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("INVALID_CREDENTIALS");

    const user = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(user?.deletedAt).toBeNull();
  });

  test("DELETE /users/me - rejects a missing password", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test("POST /users/me/delete-challenge - confirms the password without requiring a code when 2FA is off", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me/delete-challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.twoFactorRequired).toBe(false);
    expect(twoFactorEmailSpy).not.toHaveBeenCalled();
  });

  test("POST /users/me/delete-challenge - rejects a wrong password", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me/delete-challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "WrongPass123!" }),
    });

    expect(res.status).toBe(403);
    expect(((await res.json()) as any).error.code).toBe("INVALID_CREDENTIALS");
  });

  test("POST /users/me/delete-challenge - emails a fresh 2FA code when 2FA is on", async () => {
    await enableTwoFactor(testUser);

    const res = await fetch(`${baseUrl()}/api/v1/users/me/delete-challenge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ password: "TestPass123!" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.twoFactorRequired).toBe(true);
    expect(lastTwoFactorCode()).toMatch(/^\d{6}$/);
  });

  test("DELETE /users/me - 2FA account must supply the emailed code", async () => {
    await enableTwoFactor(testUser);
    // Code is owed but not sent with the DELETE.
    const res = await deleteWithPassword("TestPass123!");

    expect(res.status).toBe(403);
    expect(((await res.json()) as any).error.code).toBe(
      "TWO_FACTOR_CODE_REQUIRED",
    );

    const user = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(user?.deletedAt).toBeNull();
  });

  test("DELETE /users/me - 2FA account rejects a wrong code", async () => {
    await enableTwoFactor(testUser);
    // Mint a real code, then send a wrong one.
    const challenge = await fetch(
      `${baseUrl()}/api/v1/users/me/delete-challenge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(testUser.id, testUser.username)),
        },
        body: JSON.stringify({ password: "TestPass123!" }),
      },
    );
    expect(challenge.status).toBe(200);

    const res = await deleteWithPassword("TestPass123!", "000000");
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe(
      "INVALID_OR_EXPIRED_2FA_CODE",
    );

    const user = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(user?.deletedAt).toBeNull();
  });

  test("DELETE /users/me - 2FA account deletes with password + the emailed code", async () => {
    await enableTwoFactor(testUser);

    const challenge = await fetch(
      `${baseUrl()}/api/v1/users/me/delete-challenge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(testUser.id, testUser.username)),
        },
        body: JSON.stringify({ password: "TestPass123!" }),
      },
    );
    expect(challenge.status).toBe(200);

    const res = await deleteWithPassword("TestPass123!", lastTwoFactorCode());
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(user?.deletedAt).not.toBeNull();

    // The code was single-use: nothing left to replay.
    const left = await prisma.verificationToken.count({
      where: { userId: testUser.id, type: "TWO_FACTOR" },
    });
    expect(left).toBe(0);
  });

  test("POST /users/me/delete-challenge - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me/delete-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "TestPass123!" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /auth/recover-account/verify - restores a deleted account", async () => {
    // Soft-delete the account, then mint a recovery token with a known value.
    await prisma.user.update({
      where: { id: testUser.id },
      data: { deletedAt: new Date() },
    });
    const plaintext = `recover.${Date.now()}`;
    const tokenHash = crypto
      .createHash("sha256")
      .update(plaintext)
      .digest("hex");
    await prisma.verificationToken.create({
      data: {
        userId: testUser.id,
        type: "ACCOUNT_RECOVERY",
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await fetch(`${baseUrl()}/api/v1/auth/recover-account/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: plaintext }),
    });
    expect(res.status).toBe(200);

    // The account is live again and the used token is gone.
    const restored = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(restored?.deletedAt).toBeNull();

    const left = await prisma.verificationToken.count({
      where: { userId: testUser.id, type: "ACCOUNT_RECOVERY" },
    });
    expect(left).toBe(0);

    // And the owner can sign straight back in.
    const login = await fetch(`${baseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: testUser.email,
        password: "TestPass123!",
      }),
    });
    expect(login.status).toBe(200);
  });

  test("POST /auth/recover-account/verify - rejects an expired or bogus token", async () => {
    await prisma.user.update({
      where: { id: testUser.id },
      data: { deletedAt: new Date() },
    });
    const plaintext = `expired.${Date.now()}`;
    await prisma.verificationToken.create({
      data: {
        userId: testUser.id,
        type: "ACCOUNT_RECOVERY",
        tokenHash: crypto
          .createHash("sha256")
          .update(plaintext)
          .digest("hex"),
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    const res = await fetch(`${baseUrl()}/api/v1/auth/recover-account/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: plaintext }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe(
      "INVALID_OR_EXPIRED_RECOVERY_TOKEN",
    );

    const stillDeleted = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(stillDeleted?.deletedAt).not.toBeNull();
  });

  test("POST /auth/recover-account/verify - cannot recover a live account", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/auth/recover-account/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /users/me - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  test("GET /users/check-username - should return available for unused username", async () => {
    const username = `check.${Date.now()}`;
    const res = await fetch(
      `${baseUrl()}/api/v1/users/check-username?username=${username}`,
      {
        headers: await authHeader(testUser.id, testUser.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("available", true);
  });

  test("GET /users/check-username - should return not available for used username", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/users/check-username?username=${encodeURIComponent(testUser.username)}`,
      {
        headers: await authHeader(testUser.id, testUser.username),
      },
    );

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /users/check-username - should fail without username query param", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/check-username`, {
      headers: await authHeader(testUser.id, testUser.username),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(data.error.details)).toBe(true);
  });

  test("GET /users/search - should return matching users", async () => {
    const uniqueName = `searchable.${Date.now()}`;
    await createTestUser({
      username: uniqueName,
      firstName: "Searchable",
      lastName: "User",
    });

    const res = await fetch(
      `${baseUrl()}/api/v1/users/search?query=${encodeURIComponent(uniqueName)}`,
      {
        headers: await authHeader(testUser.id, testUser.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users[0]).toHaveProperty("username", uniqueName);
  });

  test("GET /users/search - should return empty array for no matches", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/users/search?query=${encodeURIComponent("nonexistent-user-xyz-12345")}`,
      {
        headers: await authHeader(testUser.id, testUser.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBe(0);
  });

  test("GET /users/search - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/search?query=test`);

    expect(res.status).toBe(401);
  });

  test("GET /users/:username - should return user profile by username", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/users/${encodeURIComponent(testUser.username)}`,
      {
        headers: await authHeader(testUser.id, testUser.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("username", testUser.username);
    expect(data).toHaveProperty("verified", testUser.isEmailVerified);
    expect(data).toHaveProperty("firstName", "Test");
    expect(data).toHaveProperty("lastName", "User");
    expect(data).toHaveProperty("displayName", "Test User");
    expect(data).toHaveProperty("id", testUser.id);
    expect(data).toHaveProperty("friendsCount", 0);
    expect(data.friendshipStatus).toBe("self");
    expect(typeof data.joinedAt).toBe("string");
  });

  test("GET /users/:username - reports friendship status between two users", async () => {
    const other = await createTestUser({
      username: `other.${Date.now()}`,
      email: `other.${Date.now()}@example.com`,
    });

    const url = `${baseUrl()}/api/v1/users/${encodeURIComponent(other.username)}`;
    const asMe = { headers: await authHeader(testUser.id, testUser.username) };

    // No relationship yet.
    let data = (await (await fetch(url, asMe)).json()) as any;
    expect(data.friendshipStatus).toBe("none");
    expect(data.pendingRequestId).toBeFalsy();

    // I send them a request.
    const request = await prisma.friendRequest.create({
      data: { senderId: testUser.id, receiverId: other.id, status: "PENDING" },
    });
    data = (await (await fetch(url, asMe)).json()) as any;
    expect(data.friendshipStatus).toBe("request_sent");
    expect(data.pendingRequestId).toBe(request.id);

    // They see it as an incoming request.
    const asThem = (await (
      await fetch(
        `${baseUrl()}/api/v1/users/${encodeURIComponent(testUser.username)}`,
        { headers: await authHeader(other.id, other.username) },
      )
    ).json()) as any;
    expect(asThem.friendshipStatus).toBe("request_received");

    // Once befriended.
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
    });
    const [a, b] = [testUser.id, other.id].sort() as [string, string];
    await prisma.friendship.create({ data: { user1Id: a, user2Id: b } });
    data = (await (await fetch(url, asMe)).json()) as any;
    expect(data.friendshipStatus).toBe("friends");
    expect(data.friendsCount).toBe(1);
  });

  test("GET /users/:username - should return 404 for non-existent username", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/users/nonexistent-user-xyz-12345`,
      {
        headers: await authHeader(testUser.id, testUser.username),
      },
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /users/:username - should fail without auth", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/users/${encodeURIComponent(testUser.username)}`,
    );

    expect(res.status).toBe(401);
  });
});
