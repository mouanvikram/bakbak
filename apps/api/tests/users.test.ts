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
} from "bun:test";
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@bakbak/db";
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
      username: `user-${Date.now()}`,
      email: `user-${Date.now()}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

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
    const newName = `renamed-${Date.now()}`;
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
      username: `taken-${Date.now()}`,
      email: `taken-${Date.now()}@example.com`,
    });

    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(testUser.id, testUser.username)),
      },
      body: JSON.stringify({ username: other.username }),
    });

    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error.code).toBe(
      "USERNAME_ALREADY_EXISTS",
    );

    const row = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(row?.username).toBe(testUser.username);
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
      headers: await authHeader(testUser.id, testUser.username),
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
      email: `unver-${Date.now()}@example.com`,
      isEmailVerified: false,
    });

    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
      headers: await authHeader(unverified.id, unverified.username),
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
      email: `other-${Date.now()}@example.com`,
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
      headers: await authHeader(testUser.id, testUser.username),
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
      headers: await authHeader(testUser.id, testUser.username),
    });

    const login = await fetch(`${baseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: testUser.email,
        password: "TestPass123!",
      }),
    });
    expect(login.status).toBe(401);
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
      headers: await authHeader(testUser.id, testUser.username),
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

  test("DELETE /users/me - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  test("GET /users/check-username - should return available for unused username", async () => {
    const username = `check-${Date.now()}`;
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
    const uniqueName = `searchable-${Date.now()}`;
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
      username: `other-${Date.now()}`,
      email: `other-${Date.now()}@example.com`,
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
