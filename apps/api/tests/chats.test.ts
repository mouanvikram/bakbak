import "./setup";
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
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@bakbak/db";
import {
  cleanupDatabase,
  createTestUser,
  createTestDirectChat,
  createTestGroupChat,
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

describe("Chats Endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let userC: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    if (!DB_AVAILABLE) {
      console.warn("Skipping chats tests - database not available");
      return;
    }
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
    userA = await createTestUser({
      username: `chatA-${Date.now()}`,
      email: `chatA-${Date.now()}@example.com`,
    });
    userB = await createTestUser({
      username: `chatB-${Date.now()}`,
      email: `chatB-${Date.now()}@example.com`,
    });
    userC = await createTestUser({
      username: `chatC-${Date.now()}`,
      email: `chatC-${Date.now()}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  test("POST /chats/ - should create direct chat", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "DIRECT",
        participantId: userB.id,
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("type", "DIRECT");
    expect(data).toHaveProperty("id");
    expect(data.participants).toHaveLength(2);
  });

  test("POST /chats/ - should reuse existing direct chat (idempotent)", async () => {
    await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "DIRECT",
        participantId: userB.id,
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("type", "DIRECT");
  });

  test("POST /chats/ - should create group chat", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "GROUP",
        name: "Test Group",
        participantIds: [userB.id, userC.id],
        avatar: "https://example.com/group-avatar.png",
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("type", "GROUP");
    expect(data).toHaveProperty("name", "Test Group");
    expect(data).toHaveProperty(
      "avatar",
      "https://example.com/group-avatar.png",
    );
    expect(data.participants).toHaveLength(3);
  });

  test("POST /chats/ - should fail creating group chat without name", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "GROUP",
        participantIds: [userB.id, userC.id],
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /chats/ - should fail creating group chat without participants", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "GROUP",
        name: "Test Group",
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /chats/ - should fail creating direct chat without participant id", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "DIRECT",
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /chats/ - should fail with invalid chat type", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "INVALID",
        participantId: userB.id,
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /chats/ - should fail creating direct chat with self", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "DIRECT",
        participantId: userA.id,
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /chats/ - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "DIRECT", participantId: userB.id }),
    });

    expect(res.status).toBe(401);
  });

  test("GET /chats/ - should list user chats", async () => {
    await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.chats).toBeDefined();
    expect(Array.isArray(data.chats)).toBe(true);
    expect(data.chats.length).toBeGreaterThan(0);
  });

  test("GET /chats/ - should return empty array for user with no chats", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.chats).toBeDefined();
    expect(Array.isArray(data.chats)).toBe(true);
    expect(data.chats.length).toBe(0);
  });

  test("GET /chats/ - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/`);

    expect(res.status).toBe(401);
  });

  test("GET /chats/:chatId - should return chat details", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("id", chat.id);
    expect(data).toHaveProperty("type", "DIRECT");
  });

  test("GET /chats/:chatId - should return 400 for malformed chat id", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/nonexistent-chat-id`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /chats/:chatId - should fail for non-participant", async () => {
    const chat = await createTestDirectChat(userB.id, userC.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /chats/:chatId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/some-chat-id`);

    expect(res.status).toBe(401);
  });

  test("PATCH /chats/:chatId - should update group chat name", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ name: "Updated Group Name" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("name", "Updated Group Name");
  });

  test("PATCH /chats/:chatId - should update group chat avatar", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ avatar: "https://example.com/new-avatar.png" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("avatar", "https://example.com/new-avatar.png");
  });

  test("PATCH /chats/:chatId - should fail updating direct chat", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("PATCH /chats/:chatId - should fail when non-admin updates group chat", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify({ name: "Hacked Name" }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("PATCH /chats/:chatId - should fail with empty name", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ name: "   " }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("PATCH /chats/:chatId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/some-chat-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(401);
  });

  test("DELETE /chats/:chatId - should delete group chat by admin", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toBeDefined();

    const deletedChat = await prisma.chat.findUnique({
      where: { id: chat.id },
    });
    expect(deletedChat).toBeNull();
  });

  test("DELETE /chats/:chatId - should fail deleting direct chat", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /chats/:chatId - should fail when non-admin deletes group chat", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}`, {
      method: "DELETE",
      headers: await authHeader(userB.id, userB.username),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /chats/:chatId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/some-chat-id`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  test("POST /chats/:chatId/leave - hides a direct chat for the caller only", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/leave`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
    });
    expect(res.status).toBe(200);

    // Gone from A's list...
    const listA = await fetch(`${baseUrl()}/api/v1/chats`, {
      headers: await authHeader(userA.id, userA.username),
    });
    expect(
      ((await listA.json()) as any).chats.map((c: any) => c.id),
    ).not.toContain(chat.id);

    // ...still there for B, and the row still exists.
    const listB = await fetch(`${baseUrl()}/api/v1/chats`, {
      headers: await authHeader(userB.id, userB.username),
    });
    expect(((await listB.json()) as any).chats.map((c: any) => c.id)).toContain(
      chat.id,
    );
    expect(
      await prisma.chat.findUnique({ where: { id: chat.id } }),
    ).not.toBeNull();
  });

  test("POST /chats/:chatId/leave - removes the caller from a group", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/leave`, {
      method: "POST",
      headers: await authHeader(userB.id, userB.username),
    });
    expect(res.status).toBe(200);

    const participant = await prisma.chatParticipant.findFirst({
      where: { chatId: chat.id, userId: userB.id },
    });
    expect(participant?.leftAt).not.toBeNull();
  });

  test("POST /chats/:chatId/leave - fails for a non-participant", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/leave`, {
      method: "POST",
      headers: await authHeader(userC.id, userC.username),
    });
    expect(res.status).toBe(403);
  });

  test("POST /chats/:chatId/leave - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${randomUUID()}/leave`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("POST /chats/:chatId/members - should add participant to group chat", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ participantId: userC.id }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("userId", userC.id);
    expect(data).toHaveProperty("role", "MEMBER");
  });

  test("POST /chats/:chatId/members - should fail adding member to direct chat", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ participantId: userC.id }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /chats/:chatId/members - should fail when non-admin adds member", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id]);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify({ participantId: userC.id }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /chats/:chatId/members - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/some-chat-id/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: userB.id }),
    });

    expect(res.status).toBe(401);
  });

  test("DELETE /chats/:chatId/members/:userId - should remove participant from group chat", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/members/${userC.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("userId", userC.id);
    expect(data).toHaveProperty("leftAt");
  });

  test("DELETE /chats/:chatId/members/:userId - should allow self-removal", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/members/${userB.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("userId", userB.id);
    expect(data).toHaveProperty("leftAt");
  });

  test("DELETE /chats/:chatId/members/:userId - should fail removing from direct chat", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/members/${userB.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /chats/:chatId/members/:userId - should fail without auth", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/chats/some-chat-id/members/some-user-id`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(401);
  });
});
