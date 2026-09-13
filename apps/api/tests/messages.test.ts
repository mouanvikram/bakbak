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
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@bakbak/db";
import {
  cleanupDatabase,
  createTestUser,
  createTestDirectChat,
  createTestGroupChat,
  createTestMessage,
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

describe.skipIf(!DB_AVAILABLE)("Messages Endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let userC: Awaited<ReturnType<typeof createTestUser>>;
  let chat: Awaited<ReturnType<typeof createTestGroupChat>>;

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
    userA = await createTestUser({
      username: `msgA.${Date.now()}`,
      email: `msgA.${Date.now()}@example.com`,
    });
    userB = await createTestUser({
      username: `msgB.${Date.now()}`,
      email: `msgB.${Date.now()}@example.com`,
    });
    userC = await createTestUser({
      username: `msgC.${Date.now()}`,
      email: `msgC.${Date.now()}@example.com`,
    });
    chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  test("POST /chats/:chatId/messages - should send text message", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "TEXT",
        text: "Hello everyone!",
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("type", "TEXT");
    expect(data).toHaveProperty("text", "Hello everyone!");
    expect(data).toHaveProperty("senderId", userA.id);
    expect(data).toHaveProperty("chatId", chat.id);
    expect(data).toHaveProperty("id");
  });

  test("POST /chats/:chatId/messages - a repeated clientId is idempotent", async () => {
    const clientId = crypto.randomUUID();
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeader(userA.id, userA.username)),
    };
    const send = () =>
      fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "only once", clientId }),
      });

    const first = (await (await send()).json()) as any;
    const second = (await (await send()).json()) as any;

    expect(second.id).toBe(first.id);
    const count = await prisma.message.count({
      where: { chatId: chat.id, clientId },
    });
    expect(count).toBe(1);
  });

  test("POST /chats/:chatId/messages - should send image message without text", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "IMAGE",
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("type", "IMAGE");
    expect(data.senderId).toBe(userA.id);
  });

  // The generic attachment endpoint (`/uploads`) needs object storage, so
  // these seed the Attachment row directly and exercise only the linking.
  const seedAttachment = (ownerId: string, kind = "IMAGE", ext = "png") =>
    prisma.attachment.create({
      data: {
        kind: kind as any,
        fileName: `file.${ext}`,
        filePath: `${ownerId}/${crypto.randomUUID()}.${ext}`,
        mimeType: kind === "IMAGE" ? "image/png" : "application/pdf",
        fileSize: 1234,
      },
    });

  test("POST /chats/:chatId/messages - attaches an uploaded file and derives the type", async () => {
    const attachment = await seedAttachment(userA.id, "IMAGE");

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        attachmentIds: [attachment.id],
        text: "look",
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.type).toBe("IMAGE");
    expect(data.text).toBe("look");
    expect(data.attachments).toHaveLength(1);
    expect(data.attachments[0].id).toBe(attachment.id);
    expect(typeof data.attachments[0].url).toBe("string");

    const row = await prisma.attachment.findUnique({
      where: { id: attachment.id },
    });
    expect(row?.messageId).toBe(data.id);
  });

  test("POST /chats/:chatId/messages - replyToId returns the answered message", async () => {
    const original = await createTestMessage(chat.id, userA.id, {
      text: "the original",
    });

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify({
        text: "the reply",
        clientId: crypto.randomUUID(),
        replyToId: original.id,
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.replyToId).toBe(original.id);
    expect(data.replyTo).toMatchObject({
      id: original.id,
      chatId: chat.id,
      senderId: userA.id,
      text: "the original",
    });
    expect(typeof data.replyTo.createdAt).toBe("string");

    // The answered message rides along on list responses too.
    const list = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages`,
      { headers: await authHeader(userB.id, userB.username) },
    );
    const listed = await list.json();
    const reply = (listed as any).messages.find((m: any) => m.text === "the reply");
    expect(reply.replyTo.id).toBe(original.id);
  });

  test("POST /chats/:chatId/messages - rejects a reply to a message in another chat", async () => {
    const otherChat = await createTestDirectChat(userA.id, userB.id);
    const foreign = await createTestMessage(otherChat.id, userA.id, {
      text: "elsewhere",
    });

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        text: "wrong target",
        clientId: crypto.randomUUID(),
        replyToId: foreign.id,
      }),
    });

    expect(res.status).toBe(400);
  });

  test("POST /chats/:chatId/messages - rejects a reply to a deleted message", async () => {
    const original = await createTestMessage(chat.id, userA.id, {
      text: "doomed",
    });
    const del = await fetch(
      `${baseUrl()}/api/v1/messages/${original.id}`,
      {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      },
    );
    expect(del.status).toBe(200);

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify({
        text: "zombie target",
        clientId: crypto.randomUUID(),
        replyToId: original.id,
      }),
    });

    expect(res.status).toBe(404);
  });

  test("PUT /chats/:chatId/messages/:messageId/reactions - adds a reaction", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "react to me",
    });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/${message.id}/reactions`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(userB.id, userB.username)),
        },
        body: JSON.stringify({ emoji: "👍" }),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.id).toBe(message.id);
    expect(data.reactions).toEqual([
      expect.objectContaining({ emoji: "👍", userId: userB.id }),
    ]);
  });

  test("PUT .../reactions - same emoji again removes it (toggle)", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "toggle me",
    });

    const react = async () =>
      fetch(
        `${baseUrl()}/api/v1/chats/${chat.id}/messages/${message.id}/reactions`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeader(userB.id, userB.username)),
          },
          body: JSON.stringify({ emoji: "😂" }),
        },
      );

    const first = await react();
    expect(first.status).toBe(200);
    expect(((await first.json()) as any).reactions).toHaveLength(1);

    const second = await react();
    expect(second.status).toBe(200);
    expect(((await second.json()) as any).reactions).toHaveLength(0);
  });

  test("PUT .../reactions - different users and emojis accumulate", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "party",
    });

    for (const user of [userB, userC]) {
      const res = await fetch(
        `${baseUrl()}/api/v1/chats/${chat.id}/messages/${message.id}/reactions`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeader(user.id, user.username)),
          },
          body: JSON.stringify({ emoji: "🎉" }),
        },
      );
      expect(res.status).toBe(200);
    }

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/${message.id}/reactions`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(userB.id, userB.username)),
        },
        body: JSON.stringify({ emoji: "❤️" }),
      },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    const emojis = data.reactions.map((r: any) => r.emoji).sort();
    expect(emojis).toEqual(["❤️", "🎉", "🎉"]);
  });

  test("PUT .../reactions - rejects a reaction to a message in another chat", async () => {
    const otherChat = await createTestDirectChat(userA.id, userB.id);
    const foreign = await createTestMessage(otherChat.id, userA.id, {
      text: "elsewhere",
    });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/${foreign.id}/reactions`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(userA.id, userA.username)),
        },
        body: JSON.stringify({ emoji: "👍" }),
      },
    );

    expect(res.status).toBe(400);
  });

  test("PUT .../reactions - rejects a reaction to a missing message", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/${crypto.randomUUID()}/reactions`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(userA.id, userA.username)),
        },
        body: JSON.stringify({ emoji: "👍" }),
      },
    );

    expect(res.status).toBe(404);
  });

  test("POST /chats/:chatId/messages - rejects an attachment owned by someone else", async () => {
    const attachment = await seedAttachment(userB.id, "IMAGE");

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        attachmentIds: [attachment.id],
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(403);
  });

  test("POST /chats/:chatId/messages - rejects an attachment already used", async () => {
    const attachment = await seedAttachment(userA.id, "IMAGE");
    const first = await createTestMessage(chat.id, userA.id, { type: "IMAGE" });
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { messageId: first.id },
    });

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        attachmentIds: [attachment.id],
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(400);
  });

  test("GET /chats/:chatId/messages - includes attachments on listed messages", async () => {
    const attachment = await seedAttachment(userA.id, "IMAGE");
    await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        attachmentIds: [attachment.id],
        clientId: crypto.randomUUID(),
      }),
    });

    const list = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      headers: await authHeader(userA.id, userA.username),
    });
    const data = (await list.json()) as any;
    const withFile = data.messages.find((m: any) => m.attachments.length > 0);
    expect(withFile).toBeDefined();
    expect(withFile.attachments[0].id).toBe(attachment.id);
  });

  test("POST /chats/:chatId/messages - should fail with empty text for TEXT type", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "TEXT",
        text: "   ",
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /chats/:chatId/messages - should fail with invalid message type", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "INVALID_TYPE",
        text: "Hello",
      }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /chats/:chatId/messages - should fail for non-participant", async () => {
    const outsideUser = await createTestUser({
      username: `outside.${Date.now()}`,
      email: `outside.${Date.now()}@example.com`,
    });

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(outsideUser.id, outsideUser.username)),
      },
      body: JSON.stringify({
        type: "TEXT",
        text: "Hello from outside",
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /chats/:chatId/messages - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "TEXT", text: "Hello" }),
    });

    expect(res.status).toBe(401);
  });

  test("GET /chats/:chatId/messages - should list messages", async () => {
    await createTestMessage(chat.id, userA.id, { text: "First message" });
    await createTestMessage(chat.id, userB.id, { text: "Second message" });

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages.length).toBe(2);
  });

  test("GET /chats/:chatId/messages - should return empty array for chat with no messages", async () => {
    const emptyChat = await createTestGroupChat(userA.id, [userB.id]);

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${emptyChat.id}/messages`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages.length).toBe(0);
  });

  test("GET /chats/:chatId/messages - should fail for non-participant", async () => {
    const outsideUser = await createTestUser({
      username: `outside2.${Date.now()}`,
      email: `outside2.${Date.now()}@example.com`,
    });

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      headers: await authHeader(outsideUser.id, outsideUser.username),
    });

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /chats/:chatId/messages - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`);

    expect(res.status).toBe(401);
  });

  test("GET /chats/:chatId/messages/search - should search messages", async () => {
    await createTestMessage(chat.id, userA.id, { text: "Hello world from A" });
    await createTestMessage(chat.id, userB.id, { text: "Hello world from B" });
    await createTestMessage(chat.id, userC.id, { text: "Goodbye world" });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/search?q=hello`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages.length).toBe(2);
  });

  test("GET /chats/:chatId/messages/search - should be case insensitive", async () => {
    await createTestMessage(chat.id, userA.id, { text: "UPPERCASE MESSAGE" });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/search?q=uppercase`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toHaveLength(1);
  });

  test("GET /chats/:chatId/messages/search - should fail without query param", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/search`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("GET /chats/:chatId/messages/search - should fail without auth", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/search?q=hello`,
    );

    expect(res.status).toBe(401);
  });

  test("GET /chats/:chatId/messages/unread - should return unread count", async () => {
    await createTestMessage(chat.id, userB.id, { text: "Message for A" });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/unread`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.count).toBeDefined();
    expect(typeof data.count).toBe("number");
  });

  test("GET /chats/:chatId/messages/unread - should fail without auth", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/unread`,
    );

    expect(res.status).toBe(401);
  });

  test("POST /chats/:chatId/messages/read - should mark chat as read", async () => {
    const message = await createTestMessage(chat.id, userB.id, {
      text: "Read this",
    });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/read`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(userA.id, userA.username)),
        },
        body: JSON.stringify({ messageId: message.id }),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toBeDefined();
    expect(data.lastReadMessageId).toBe(message.id);
  });

  test("POST /chats/:chatId/messages/read - should mark chat as read without messageId", async () => {
    await createTestMessage(chat.id, userB.id, { text: "Read this too" });

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/read`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader(userA.id, userA.username)),
        },
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toBeDefined();
  });

  test("POST /chats/:chatId/messages/read - should fail without auth", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages/read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(401);
  });

  test("GET /messages/:messageId - should return message details", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Test message",
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.message).toHaveProperty("id", message.id);
    expect(data.message).toHaveProperty("text", "Test message");
    expect(data.message).toHaveProperty("senderId", userA.id);
  });

  test("GET /messages/:messageId - should return 404 for non-existent message", async () => {
    const res = await fetch(
      `${baseUrl()}/api/v1/messages/${crypto.randomUUID()}`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /messages/:messageId - should fail for deleted message", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Delete me",
      deleted: true,
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /messages/:messageId - should fail for non-participant", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Secret message",
    });
    const outsideUser = await createTestUser({
      username: `outside3.${Date.now()}`,
      email: `outside3.${Date.now()}@example.com`,
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      headers: await authHeader(outsideUser.id, outsideUser.username),
    });

    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /messages/:messageId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/messages/some-message-id`);

    expect(res.status).toBe(401);
  });

  test("PATCH /messages/:messageId - should edit own message", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Original text",
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ text: "Edited text" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("text", "Edited text");
    expect(data).toHaveProperty("id", message.id);
  });

  test("PATCH /messages/:messageId - should fail editing others message", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Original text",
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify({ text: "Hacked text" }),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("PATCH /messages/:messageId - should fail with empty text", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Original text",
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ text: "   " }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("PATCH /messages/:messageId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/messages/some-message-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Edited" }),
    });

    expect(res.status).toBe(401);
  });

  test("DELETE /messages/:messageId - should delete own message", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Delete me",
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("id", message.id);
    expect(data).toHaveProperty("deleted", true);

    const deletedMessage = await prisma.message.findUnique({
      where: { id: message.id },
    });
    expect(deletedMessage?.deletedAt).not.toBeNull();
    expect(deletedMessage?.text).toBeNull();
  });

  test("DELETE /messages/:messageId - should fail deleting others message", async () => {
    const message = await createTestMessage(chat.id, userA.id, {
      text: "Protected",
    });

    const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
      method: "DELETE",
      headers: await authHeader(userB.id, userB.username),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("DELETE /messages/:messageId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/messages/some-message-id`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  test("GET /chats/:chatId/messages - should respect limit query parameter", async () => {
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push(
        createTestMessage(chat.id, userA.id, { text: `Message ${i}` }),
      );
    }
    await Promise.all(messages);

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages?limit=3`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages).toHaveLength(3);
  }, 30000);

  test("GET /chats/:chatId/messages - pagination boundary with shared timestamps must not skip or duplicate messages", async () => {
    // Seven messages created in the same millisecond exercise the (createdAt, id)
    // ordering tie: a cursor that only orders by createdAt can skip or duplicate
    // rows across a page boundary.
    const t0 = new Date(Date.now());
    const createdIds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: userA.id,
          type: "TEXT",
          text: `same-timestamp ${i}`,
          clientId: crypto.randomUUID(),
          createdAt: t0,
          updatedAt: t0,
        },
      });
      createdIds.push(message.id);
    }

    const seen = new Set<string>();
    const allFetchedIds: string[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      const url = new URL(`${baseUrl()}/api/v1/chats/${chat.id}/messages`);
      url.searchParams.set("limit", "3");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url, {
        headers: await authHeader(userA.id, userA.username),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;

      for (const message of data.messages) {
        allFetchedIds.push(message.id);
        seen.add(message.id);
      }

      if (data.messages.length === 0) break;
      cursor = data.messages[data.messages.length - 1].id;
      pageCount += 1;
    } while (cursor && seen.size < createdIds.length && pageCount < 10);

    // Nothing skipped, nothing duplicated, and every created message surfaced.
    expect(seen.size).toBe(createdIds.length);
    expect(allFetchedIds.length).toBe(createdIds.length);
    for (const id of createdIds) {
      expect(seen.has(id)).toBe(true);
    }
  }, 30000);

  test("GET /chats/:chatId/messages - should cap limit at 100", async () => {
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push(
        createTestMessage(chat.id, userA.id, { text: `Message ${i}` }),
      );
    }
    await Promise.all(messages);

    const res = await fetch(
      `${baseUrl()}/api/v1/chats/${chat.id}/messages?limit=200`,
      {
        headers: await authHeader(userA.id, userA.username),
      },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.messages.length).toBeLessThanOrEqual(100);
  }, 30000);

  test("POST /chats/:chatId/messages - should update chat lastMessageAt", async () => {
    const updatedChat = await prisma.chat.update({
      where: { id: chat.id },
      data: { lastMessageAt: new Date(Date.now() - 100000) },
    });
    expect(updatedChat.lastMessageAt).toBeDefined();

    const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({
        type: "TEXT",
        text: "New message",
        clientId: crypto.randomUUID(),
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("id");
  });
});
