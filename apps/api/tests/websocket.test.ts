import "./setup";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import app from "@/app";
import { socketAuthMiddleware, type AuthenticatedSocket } from "@/websocket/auth";
import { registerConnection } from "@/websocket/connection";
import { setIo } from "@/websocket/emitter";
import {
  authHeader,
  cleanupDatabase,
  createTestGroupChat,
  createTestUser,
  isDatabaseAvailable,
} from "./helpers";

const DB_AVAILABLE = await isDatabaseAvailable();

type TestUser = Awaited<ReturnType<typeof createTestUser>>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 3000) {
  const started = Date.now();
  while (!(await check())) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await sleep(25);
  }
}

// A real Socket.IO server wired exactly like production (auth middleware +
// registerConnection + emitter), minus the Redis adapter: one process, so the
// in-memory adapter behaves the same for these room-membership checks.
describe.skipIf(!DB_AVAILABLE)("WebSocket chat rooms", () => {
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  let port: number;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    setIo(io);
    io.use(socketAuthMiddleware);
    io.on("connection", (socket) =>
      registerConnection(io, socket as AuthenticatedSocket),
    );
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    httpServer.closeAllConnections();
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  beforeEach(async () => {
    await cleanupDatabase();
    const ts = Date.now();
    alice = await createTestUser({ username: `wsA.${ts}`, email: `wsA.${ts}@example.com` });
    bob = await createTestUser({ username: `wsB.${ts}`, email: `wsB.${ts}@example.com` });
    carol = await createTestUser({ username: `wsC.${ts}`, email: `wsC.${ts}@example.com` });
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await sleep(50);
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  async function connect(user: TestUser): Promise<ClientSocket> {
    const { Authorization } = await authHeader(user.id, user.username);
    const socket = ioClient(baseUrl(), {
      auth: { token: Authorization.slice("Bearer ".length) },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });
    return socket;
  }

  /** Server-side truth: is any socket of this user in the chat's room? */
  async function inRoom(userId: string, chatId: string) {
    const sockets = await io.in(`chat:${chatId}`).fetchSockets();
    return sockets.some((s) => (s.data as { userId?: string }).userId === userId);
  }

  function record(socket: ClientSocket, event: string) {
    const received: any[] = [];
    socket.on(event, (payload) => received.push(payload));
    return received;
  }

  async function api(user: TestUser, method: string, path: string, body?: unknown) {
    return fetch(`${baseUrl()}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader(user.id, user.username)),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function createChat(user: TestUser, body: unknown): Promise<string> {
    const res = await api(user, "POST", "/chats", body);
    expect(res.ok).toBe(true);
    return ((await res.json()) as { id: string }).id;
  }

  async function sendText(user: TestUser, chatId: string, text: string) {
    const res = await api(user, "POST", `/chats/${chatId}/messages`, {
      type: "TEXT",
      text,
      clientId: randomUUID(),
    });
    expect(res.status).toBe(201);
  }

  // ===== Leaving a room ===================================================

  test("a member removed from a group is told, then stops receiving its messages", async () => {
    const groupId = await createChat(alice, {
      type: "GROUP",
      name: "Room removal",
      participantIds: [bob.id, carol.id],
    });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, groupId));
    const updates = record(bobSocket, "chat:updated");
    const messages = record(bobSocket, "message:new");

    const res = await api(alice, "DELETE", `/chats/${groupId}/members/${bob.id}`);
    expect(res.ok).toBe(true);

    await waitFor(() => updates.length > 0);
    expect(await inRoom(bob.id, groupId)).toBe(false);

    await sendText(alice, groupId, "after bob was removed");
    await sleep(300);
    expect(messages).toHaveLength(0);
  });

  test("leaving a group stops delivery on every one of the member's sockets", async () => {
    const groupId = await createChat(alice, {
      type: "GROUP",
      name: "Room leave",
      participantIds: [bob.id, carol.id],
    });
    const bobTab1 = await connect(bob);
    const bobTab2 = await connect(bob);
    await waitFor(async () => (await io.in(`chat:${groupId}`).fetchSockets()).length >= 2);
    const tab1Messages = record(bobTab1, "message:new");
    const tab2Messages = record(bobTab2, "message:new");

    const res = await api(bob, "DELETE", `/chats/${groupId}/members/${bob.id}`);
    expect(res.ok).toBe(true);
    expect(await inRoom(bob.id, groupId)).toBe(false);

    await sendText(alice, groupId, "after bob left");
    await sleep(300);
    expect(tab1Messages).toHaveLength(0);
    expect(tab2Messages).toHaveLength(0);
  });

  test("deleting a direct chat for yourself stops its live messages", async () => {
    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, chatId));
    const messages = record(bobSocket, "message:new");

    const res = await api(bob, "POST", `/chats/${chatId}/leave`);
    expect(res.ok).toBe(true);
    expect(await inRoom(bob.id, chatId)).toBe(false);

    await sendText(alice, chatId, "after bob deleted the chat");
    await sleep(300);
    expect(messages).toHaveLength(0);
  });

  test("a client can't drop its own room with chat:leave any more", async () => {
    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, chatId));
    const messages = record(bobSocket, "message:new");

    bobSocket.emit("chat:leave", chatId);
    await sleep(200);
    expect(await inRoom(bob.id, chatId)).toBe(true);

    await sendText(alice, chatId, "still delivered");
    await waitFor(() => messages.length === 1);
  });

  test("deleting a group tells its members and empties the room", async () => {
    const groupId = await createChat(alice, {
      type: "GROUP",
      name: "Room delete",
      participantIds: [bob.id, carol.id],
    });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, groupId));
    const updates = record(bobSocket, "chat:updated");

    const res = await api(alice, "DELETE", `/chats/${groupId}`);
    expect(res.ok).toBe(true);

    // The client reads "no participants" as "this chat is gone for me".
    await waitFor(() => updates.length > 0);
    expect(updates[0].id).toBe(groupId);
    expect(updates[0].participants).toEqual([]);

    await waitFor(
      async () => (await io.in(`chat:${groupId}`).fetchSockets()).length === 0,
    );
  });

  // ===== Joining a room ===================================================

  test("a new direct chat delivers its first message live, without a reconnect", async () => {
    const bobSocket = await connect(bob);
    await connect(alice);
    const messages = record(bobSocket, "message:new");

    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    expect(await inRoom(bob.id, chatId)).toBe(true);

    await sendText(alice, chatId, "hi bob");
    await waitFor(() => messages.length === 1);
    expect(messages[0].text).toBe("hi bob");
  });

  test("a new group delivers live to members who were already connected", async () => {
    const carolSocket = await connect(carol);
    const messages = record(carolSocket, "message:new");

    const groupId = await createChat(alice, {
      type: "GROUP",
      name: "Room create",
      participantIds: [bob.id, carol.id],
    });
    expect(await inRoom(carol.id, groupId)).toBe(true);

    await sendText(alice, groupId, "welcome");
    await waitFor(() => messages.length === 1);
  });

  test("re-opening a deleted direct chat delivers live again", async () => {
    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, chatId));
    expect((await api(bob, "POST", `/chats/${chatId}/leave`)).ok).toBe(true);
    expect(await inRoom(bob.id, chatId)).toBe(false);

    const reopenedId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    expect(reopenedId).toBe(chatId);
    expect(await inRoom(bob.id, chatId)).toBe(true);

    const messages = record(bobSocket, "message:new");
    await sendText(alice, chatId, "back again");
    await waitFor(() => messages.length === 1);
  });

  test("createTestGroupChat members are auto-joined on connect", async () => {
    const group = await createTestGroupChat(alice.id, [bob.id, carol.id]);
    await connect(bob);
    await waitFor(() => inRoom(bob.id, group.id));
  });

  // ===== Membership re-checks =============================================

  test("typing from a non-member never reaches the chat room", async () => {
    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, chatId));
    const typings = record(bobSocket, "typing");

    const carolSocket = await connect(carol);
    carolSocket.emit("typing", { chatId, isTyping: true });

    await sleep(300);
    expect(typings).toHaveLength(0);
    expect(await inRoom(carol.id, chatId)).toBe(false);
  });

  test("read:receipt from a non-member persists nothing and reaches nobody", async () => {
    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, chatId));
    const receipts = record(bobSocket, "read:receipt");

    const carolSocket = await connect(carol);
    carolSocket.emit("read:receipt", { chatId, messageId: randomUUID() });

    await sleep(300);
    expect(receipts).toHaveLength(0);
  });

  test("chat:join from a non-member is ignored — no room, no presence", async () => {
    const chatId = await createChat(alice, { type: "DIRECT", participantId: bob.id });
    const bobSocket = await connect(bob);
    await waitFor(() => inRoom(bob.id, chatId));
    const presence = record(bobSocket, "presence");

    const carolSocket = await connect(carol);
    carolSocket.emit("chat:join", chatId);

    await sleep(300);
    expect(await inRoom(carol.id, chatId)).toBe(false);
    expect(presence).toHaveLength(0);
  });

  test("a member removed from a chat can no longer broadcast typing", async () => {
    const groupId = await createChat(alice, {
      type: "GROUP",
      name: "Member recheck",
      participantIds: [bob.id, carol.id],
    });
    const carolSocket = await connect(carol);
    await waitFor(() => inRoom(carol.id, groupId));
    const typings = record(carolSocket, "typing");

    const res = await api(alice, "DELETE", `/chats/${groupId}/members/${bob.id}`);
    expect(res.ok).toBe(true);

    const bobSocket = await connect(bob);
    bobSocket.emit("typing", { chatId: groupId, isTyping: true });

    await sleep(300);
    expect(typings).toHaveLength(0);
    expect(await inRoom(bob.id, groupId)).toBe(false);
  });
});
