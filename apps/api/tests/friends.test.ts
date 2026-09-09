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
import app from "../src/app";
import { prisma } from "@bakbak/db";
import {
  cleanupDatabase,
  createTestUser,
  createTestFriendship,
  sendFriendRequest,
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

describe("Friends Endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let userC: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    if (!DB_AVAILABLE) {
      console.warn("Skipping friends tests - database not available");
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
    const timestamp = Date.now();
    userA = await createTestUser({
      username: `friendA-${timestamp}`,
      email: `friendA-${timestamp}@example.com`,
    });
    userB = await createTestUser({
      username: `friendB-${timestamp}`,
      email: `friendB-${timestamp}@example.com`,
    });
    userC = await createTestUser({
      username: `friendC-${timestamp}`,
      email: `friendC-${timestamp}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  test("POST /friends/requests/:receiverId - should send friend request", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${userB.id}`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.sender.id).toBe(userA.id);
    expect(data.receiver.id).toBe(userB.id);
    expect(data.status).toBe("PENDING");
  });

  test("POST /friends/requests/:receiverId - should fail sending request to self", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${userA.id}`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /friends/requests/:receiverId - should fail without auth", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${userB.id}`,
      {
        method: "POST",
      },
    );

    expect(res.status).toBe(401);
  });

  test("POST /friends/requests/:receiverId - should fail with invalid receiver id format", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/requests/not-a-uuid`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
  });

  test("POST /friends/requests/:receiverId - should fail for non-existent receiver", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${randomUUID()}`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("USER_NOT_FOUND");
  });

  test("POST /friends/requests/:requestId/accept - should accept pending request", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/accept`,
      {
        method: "POST",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("id", request.id);
    expect(data).toHaveProperty("status", "ACCEPTED");

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: userA.id, user2Id: userB.id },
          { user1Id: userB.id, user2Id: userA.id },
        ],
      },
    });
    expect(friendship).toBeDefined();
  });

  test("POST /friends/requests/:requestId/accept - should only allow receiver to accept", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);

    const senderRes = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/accept`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(senderRes.status).toBe(403);
    const senderData = (await senderRes.json()) as any;
    expect(senderData.error).toBeDefined();
    expect(senderData.error.code).toBe("FORBIDDEN");

    const strangerRes = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/accept`,
      {
        method: "POST",
        headers: await authHeader(userC.id, userC.username),
      },
    );

    expect(strangerRes.status).toBe(403);

    const updated = await prisma.friendRequest.findUnique({
      where: { id: request.id },
    });
    expect(updated?.status).toBe("PENDING");
  });

  test("POST /friends/requests/:requestId/accept - should fail for non-existent request", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${randomUUID()}/accept`,
      {
        method: "POST",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /friends/requests/:requestId/accept - should fail for already accepted request", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
    });

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/accept`,
      {
        method: "POST",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1Id: userA.id, user2Id: userB.id },
          { user1Id: userB.id, user2Id: userA.id },
        ],
      },
    });
    expect(friendships.length).toBe(0);
  });

  test("POST /friends/requests/:requestId/accept - should fail without auth", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/accept`,
      {
        method: "POST",
      },
    );

    expect(res.status).toBe(401);
  });

  test("POST /friends/requests/:requestId/reject - should reject pending request", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/reject`,
      {
        method: "POST",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("id", request.id);
    expect(data).toHaveProperty("status", "REJECTED");
  });

  test("POST /friends/requests/:requestId/reject - should only allow receiver to reject", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);

    const senderRes = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/reject`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(senderRes.status).toBe(403);
    const senderData = (await senderRes.json()) as any;
    expect(senderData.error.code).toBe("FORBIDDEN");

    const strangerRes = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}/reject`,
      {
        method: "POST",
        headers: await authHeader(userC.id, userC.username),
      },
    );

    expect(strangerRes.status).toBe(403);

    const updated = await prisma.friendRequest.findUnique({
      where: { id: request.id },
    });
    expect(updated?.status).toBe("PENDING");
  });

  test("POST /friends/requests/:requestId/reject - should fail for non-existent request", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${randomUUID()}/reject`,
      {
        method: "POST",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /friends/requests/:requestId - should cancel pending request", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("id", request.id);
    expect(data).toHaveProperty("status", "CANCELLED");
  });

  test("DELETE /friends/requests/:requestId - should only allow sender to cancel", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);

    const receiverRes = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userB.id, userB.username),
      },
    );

    expect(receiverRes.status).toBe(403);
    const receiverData = (await receiverRes.json()) as any;
    expect(receiverData.error.code).toBe("FORBIDDEN");

    const strangerRes = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userC.id, userC.username),
      },
    );

    expect(strangerRes.status).toBe(403);

    const updated = await prisma.friendRequest.findUnique({
      where: { id: request.id },
    });
    expect(updated?.status).toBe("PENDING");
  });

  test("DELETE /friends/requests/:requestId - should fail to cancel non-pending request", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
    });

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${request.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /friends/requests/:requestId - should fail for non-existent request", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${randomUUID()}`,
      {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /friends/ - should return friends list", async () => {
    const request = await sendFriendRequest(userA.id, userB.id);
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
    });
    await prisma.friendship.create({
      data: { user1Id: userA.id, user2Id: userB.id },
    });

    const res = await fetch(`${baseUrl()}/api/v1/friends/`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friendships).toBeDefined();
    expect(Array.isArray(data.friendships)).toBe(true);
    expect(data.friendships.length).toBe(1);
    expect(data.friendships[0]).toHaveProperty("friend");
    expect(data.friendships[0]).toHaveProperty("friendshipId");
  });

  test("GET /friends/ - should return empty array when no friends", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.friendships).toBeDefined();
    expect(Array.isArray(data.friendships)).toBe(true);
    expect(data.friendships.length).toBe(0);
  });

  test("GET /friends/ - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/`);

    expect(res.status).toBe(401);
  });

  test("GET /friends/requests - should return pending requests", async () => {
    const incoming = await sendFriendRequest(userB.id, userA.id);
    const outgoing = await sendFriendRequest(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/friends/requests`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("sent");
    expect(data).toHaveProperty("received");
    expect(Array.isArray(data.sent)).toBe(true);
    expect(Array.isArray(data.received)).toBe(true);
    expect(data.sent.length).toBe(1);
    expect(data.received.length).toBe(1);
    expect(data.sent[0].id).toBe(outgoing.id);
    expect(data.received[0].id).toBe(incoming.id);
  });

  test("GET /friends/requests - should return empty arrays when no requests", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/requests`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.sent).toEqual([]);
    expect(data.received).toEqual([]);
  });

  test("GET /friends/requests - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/requests`);

    expect(res.status).toBe(401);
  });

  test("POST /friends/requests/:receiverId - should not create duplicate pending requests", async () => {
    await sendFriendRequest(userA.id, userB.id);

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${userB.id}`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /friends/requests/:receiverId - should not allow duplicate reverse requests", async () => {
    await sendFriendRequest(userB.id, userA.id);

    const res = await fetch(
      `${baseUrl()}/api/v1/friends/requests/${userB.id}`,
      {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  // ── GET /friends/suggestions ────────────────────────────────────

  test("GET /friends/suggestions - should list other users", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/suggestions`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(Array.isArray(data.suggestions)).toBe(true);
    const ids = data.suggestions.map((u: any) => u.id);
    expect(ids).toContain(userB.id);
    expect(ids).toContain(userC.id);
  });

  test("GET /friends/suggestions - should never include the requester", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/suggestions`, {
      headers: await authHeader(userA.id, userA.username),
    });

    const data = (await res.json()) as any;
    const ids = data.suggestions.map((u: any) => u.id);
    expect(ids).not.toContain(userA.id);
  });

  test("GET /friends/suggestions - should exclude existing friends", async () => {
    await createTestFriendship(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/friends/suggestions`, {
      headers: await authHeader(userA.id, userA.username),
    });

    const data = (await res.json()) as any;
    const ids = data.suggestions.map((u: any) => u.id);
    expect(ids).not.toContain(userB.id);
    expect(ids).toContain(userC.id);
  });

  test("GET /friends/suggestions - should exclude users with a pending request either way", async () => {
    await sendFriendRequest(userA.id, userB.id); // outgoing
    await sendFriendRequest(userC.id, userA.id); // incoming

    const res = await fetch(`${baseUrl()}/api/v1/friends/suggestions`, {
      headers: await authHeader(userA.id, userA.username),
    });

    const data = (await res.json()) as any;
    const ids = data.suggestions.map((u: any) => u.id);
    expect(ids).not.toContain(userB.id);
    expect(ids).not.toContain(userC.id);
  });

  test("GET /friends/suggestions - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/suggestions`);
    expect(res.status).toBe(401);
  });

  // ── DELETE /friends/:friendId (unfriend by friendship id) ───────

  test("DELETE /friends/:friendId - should remove a friendship", async () => {
    const friendship = await createTestFriendship(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/friends/${friendship.id}`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message).toBeDefined();

    const list = await fetch(`${baseUrl()}/api/v1/friends/`, {
      headers: await authHeader(userA.id, userA.username),
    });
    expect(((await list.json()) as any).friendships).toHaveLength(0);
  });

  test("DELETE /friends/:friendId - should allow either participant to unfriend", async () => {
    const friendship = await createTestFriendship(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/friends/${friendship.id}`, {
      method: "DELETE",
      headers: await authHeader(userB.id, userB.username),
    });

    expect(res.status).toBe(200);
  });

  test("DELETE /friends/:friendId - should forbid a non-participant", async () => {
    const friendship = await createTestFriendship(userA.id, userB.id);

    const res = await fetch(`${baseUrl()}/api/v1/friends/${friendship.id}`, {
      method: "DELETE",
      headers: await authHeader(userC.id, userC.username),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("FORBIDDEN");
  });

  test("DELETE /friends/:friendId - should 404 for an unknown friendship", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/${randomUUID()}`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /friends/:friendId - should 400 for a malformed id", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/not-a-uuid`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(400);
  });

  test("DELETE /friends/:friendId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/friends/${randomUUID()}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });
});
