import "./setup";
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
import { webPushMock } from "./mocks/web-push";
import {
  cleanupDatabase,
  createTestUser,
  createTestGroupChat,
  createTestDirectChat,
  authHeader,
  isDatabaseAvailable,
} from "./helpers";

// Push is enabled for every test run via tests/setup.ts (fake VAPID keys),
// so the module can be imported anywhere without fear of a cached build
// carrying an empty keypair. Body-less dynamic imports keep the suite's
// intent obvious but static imports would work too.
const app = (await import("@/app")).default;
const { prisma } = await import("@bakbak/db");

const DB_AVAILABLE = await isDatabaseAvailable();

describe.skipIf(!DB_AVAILABLE)("Push Endpoints & Delivery", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;
  let userC: Awaited<ReturnType<typeof createTestUser>>;

  const subBody = (endpoint: string) => ({
    endpoint,
    keys: {
      p256dh: "BElZ7W2sK0pgeN+T8-V0Vvz1fVPZ0W9hoxxZlKJ5X0VpKQWcxkA5jLzM5y0sJPt0uWHP9x8F3oAabOylVYnKp5g=",
      auth: "EJGXgC5mYkdh4J4h2Zv2mg==",
    },
  });

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
    webPushMock.sendNotification.mockClear();
    webPushMock.setVapidDetails.mockClear();

    const ts = Date.now();
    userA = await createTestUser({
      username: `pushA.${ts}`,
      email: `pushA.${ts}@example.com`,
      displayName: "Alice Push",
    });
    userB = await createTestUser({
      username: `pushB.${ts}`,
      email: `pushB.${ts}@example.com`,
      displayName: "Bob Push",
    });
    userC = await createTestUser({
      username: `pushC.${ts}`,
      email: `pushC.${ts}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  const subscribe = async (userId: string, username: string, endpoint: string) =>
    fetch(`${baseUrl()}/api/v1/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userId, username)),
      },
      body: JSON.stringify(subBody(endpoint)),
    });

  const sendMessage = async (
    chatId: string,
    senderId: string,
    senderUsername: string,
    text = "Hello!",
  ) =>
    fetch(`${baseUrl()}/api/v1/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(senderId, senderUsername)),
      },
      body: JSON.stringify({ type: "TEXT", text, clientId: crypto.randomUUID() }),
    });

  // ── GET /push/config ─────────────────────────────────────────────────────

  test("GET /api/v1/push/config - is public and returns the VAPID key", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/push/config`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
  });

  // ── POST /push/subscribe ─────────────────────────────────────────────────

  test("POST /push/subscribe - requires auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subBody("https://push.example.com/noauth")),
    });
    expect(res.status).toBe(401);
  });

  test("POST /push/subscribe - stores the subscription", async () => {
    const endpoint = "https://push.example.com/sub-1";
    const res = await subscribe(userA.id, userA.username, endpoint);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.endpoint).toBe(endpoint);
    expect(rows[0]!.userId).toBe(userA.id);
  });

  test("POST /push/subscribe - same endpoint re-subscribes for a new user", async () => {
    const endpoint = "https://push.example.com/shared";
    await subscribe(userA.id, userA.username, endpoint);
    const res = await subscribe(userB.id, userB.username, endpoint);

    expect(res.status).toBe(200);
    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(userB.id);
  });

  test("POST /push/subscribe - rejects a payload without keys", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userA.id, userA.username)),
      },
      body: JSON.stringify({ endpoint: "https://push.example.com/invalid" }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /push/unsubscribe - removes the row", async () => {
    const endpoint = "https://push.example.com/gone";
    await subscribe(userB.id, userB.username, endpoint);

    const res = await fetch(`${baseUrl()}/api/v1/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify(subBody(endpoint)),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(0);
  });

  // ── Delivery (message → web push) ───────────────────────────────────────

  test("sending a message pushes to subscribed recipients, not the sender", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id, userC.id], {
      name: "Squad Push",
    });
    await subscribe(userA.id, userA.username, "https://push.example.com/sender");
    const bobEp = "https://push.example.com/bob";
    await subscribe(userB.id, userB.username, bobEp);
    await subscribe(userC.id, userC.username, "https://push.example.com/carol");

    const res = await sendMessage(chat.id, userA.id, userA.username, "yooo");
    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));
    expect(webPushMock.setVapidDetails).toHaveBeenCalled();
    expect(webPushMock.sendNotification).toHaveBeenCalledTimes(2);

    const calls = webPushMock.sendNotification.mock.calls;
    const endpoints = calls
      .map((c) => (c[0] as { endpoint: string }).endpoint)
      .sort();
    expect(endpoints).toEqual([bobEp, "https://push.example.com/carol"]);
    expect(endpoints).not.toContain("https://push.example.com/sender");

    const bobCall = calls.find(
      (c) => (c[0] as { endpoint: string }).endpoint === bobEp,
    )!;
    const payload = JSON.parse(bobCall[1] as string);
    expect(payload.title).toBe("Alice Push in Squad Push");
    expect(payload.body).toBe("yooo");
    expect(payload.chatId).toBe(chat.id);
    expect(payload.tag).toBe(`message:${chat.id}`);
    // Icon inputs for the service worker: sender name always, avatar when set.
    expect(payload.senderName).toBe("Alice Push");
    expect(payload).toHaveProperty("icon");
  });

  test("recipients with Messages OFF are skipped", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id], {
      name: "Quiet Group",
    });
    await subscribe(userB.id, userB.username, "https://push.example.com/quiet");

    // Bob turns Messages off.
    await fetch(`${baseUrl()}/api/v1/settings/notifications`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(userB.id, userB.username)),
      },
      body: JSON.stringify({
        messages: false,
        sounds: true,
      }),
    });

    const res = await sendMessage(chat.id, userA.id, userA.username, "anyone?");
    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));
    expect(webPushMock.sendNotification).not.toHaveBeenCalled();
  });

  test("a missing settings row counts as Messages ON (default)", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id], {
      name: "Default Group",
    });
    // Bob never touched Settings → no UserSettings row.
    await subscribe(userB.id, userB.username, "https://push.example.com/bob");

    const res = await sendMessage(chat.id, userA.id, userA.username, "boop");
    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));
    expect(webPushMock.sendNotification).toHaveBeenCalledTimes(1);
  });

  test("direct chat notifications use the sender's name as title", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);
    await subscribe(userB.id, userB.username, "https://push.example.com/direct");

    const res = await sendMessage(chat.id, userA.id, userA.username, "hey");
    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));
    const calls = webPushMock.sendNotification.mock.calls;
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0]![1] as string).title).toBe("Alice Push");
  });

  test("a message that fails to send does not push", async () => {
    const chat = await createTestGroupChat(userA.id, [userB.id], {
      name: "Silent Group",
    });
    await subscribe(userB.id, userB.username, "https://push.example.com/bob");

    // userC isn't a participant — the send must be rejected.
    const res = await sendMessage(chat.id, userC.id, userC.username, "nope");
    expect(res.status).toBe(404);

    await new Promise((r) => setTimeout(r, 50));
    expect(webPushMock.sendNotification).not.toHaveBeenCalled();
  });
});