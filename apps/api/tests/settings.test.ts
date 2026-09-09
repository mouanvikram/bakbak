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

describe("Settings Endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    if (!DB_AVAILABLE) {
      console.warn("Skipping settings tests - database not available");
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
    user = await createTestUser({
      username: `settings-${Date.now()}`,
      email: `settings-${Date.now()}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;
  const auth = () => authHeader(user.id, user.username);

  const getSettings = async () =>
    fetch(`${baseUrl()}/api/v1/settings`, {
      headers: await auth(),
    });

  const patch = async (
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ) =>
    fetch(`${baseUrl()}/api/v1/settings${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(await auth()),
      },
      body: JSON.stringify(body),
    });

  // ── GET /settings ────────────────────────────────────────────────

  test("GET /settings - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/settings`);
    expect(res.status).toBe(401);
  });

  test("GET /settings - should lazily create and return defaults", async () => {
    const res = await getSettings();

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data).toEqual({
      notifications: {
        messages: true,
        sounds: true,
        alerts: true,
        emailDigest: false,
      },
      appearance: { theme: "light", fontSize: "small" },
      chat: { enterToSend: true, mediaPreview: true },
      privacy: { twoFactorEnabled: false },
    });
  });

  test("GET /settings - should be idempotent across repeated calls", async () => {
    const first = (await (await getSettings()).json()) as any;
    const second = (await (await getSettings()).json()) as any;
    expect(second).toEqual(first);
  });

  // ── PATCH /settings/notifications ────────────────────────────────

  test("PATCH /settings/notifications - should update and persist", async () => {
    const res = await patch("/notifications", {
      messages: false,
      sounds: false,
      alerts: true,
      emailDigest: true,
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.notifications).toEqual({
      messages: false,
      sounds: false,
      alerts: true,
      emailDigest: true,
    });

    const reread = (await (await getSettings()).json()) as any;
    expect(reread.notifications).toEqual(data.notifications);
  });

  test("PATCH /settings/notifications - should return the full settings object", async () => {
    const res = await patch("/notifications", {
      messages: true,
      sounds: true,
      alerts: true,
      emailDigest: false,
    });
    const data = (await res.json()) as any;
    expect(data).toHaveProperty("notifications");
    expect(data).toHaveProperty("appearance");
    expect(data).toHaveProperty("chat");
    expect(data).toHaveProperty("privacy");
  });

  test("PATCH /settings/notifications - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/settings/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: true,
        sounds: true,
        alerts: true,
        emailDigest: false,
      }),
    });
    expect(res.status).toBe(401);
  });

  test("PATCH /settings/notifications - should reject a missing field", async () => {
    const res = await patch("/notifications", {
      messages: true,
      sounds: true,
      alerts: true,
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("PATCH /settings/notifications - should reject a non-boolean value", async () => {
    const res = await patch("/notifications", {
      messages: "yes",
      sounds: true,
      alerts: true,
      emailDigest: false,
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  // ── PATCH /settings/appearance ──────────────────────────────────

  test("PATCH /settings/appearance - should update theme and font size", async () => {
    const res = await patch("/appearance", {
      theme: "dark",
      fontSize: "large",
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.appearance).toEqual({ theme: "dark", fontSize: "large" });

    const reread = (await (await getSettings()).json()) as any;
    expect(reread.appearance).toEqual({ theme: "dark", fontSize: "large" });
  });

  test("PATCH /settings/appearance - should reject an unknown theme", async () => {
    const res = await patch("/appearance", {
      theme: "solarized",
      fontSize: "medium",
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("PATCH /settings/appearance - should reject an unknown font size", async () => {
    const res = await patch("/appearance", {
      theme: "light",
      fontSize: "gigantic",
    });
    expect(res.status).toBe(400);
  });

  test("PATCH /settings/appearance - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/settings/appearance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "dark", fontSize: "large" }),
    });
    expect(res.status).toBe(401);
  });

  // ── PATCH /settings/chat ───────────────────────────────────────

  test("PATCH /settings/chat - should update chat preferences and persist", async () => {
    const res = await patch("/chat", {
      enterToSend: false,
      mediaPreview: false,
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.chat).toEqual({
      enterToSend: false,
      mediaPreview: false,
    });

    const reread = (await (await getSettings()).json()) as any;
    expect(reread.chat).toEqual(data.chat);
  });

  test("PATCH /settings/chat - should reject a missing field", async () => {
    const res = await patch("/chat", { enterToSend: false });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("PATCH /settings/chat - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/settings/chat`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enterToSend: true, mediaPreview: true }),
    });
    expect(res.status).toBe(401);
  });

  // 2FA is managed through /auth/2fa/* (verified with an emailed code), not a
  // plain settings PATCH — `getSettings().privacy.twoFactorEnabled` is
  // read-only. The auth suite covers the enable/disable/login flow.
  test("PATCH /settings/privacy - is gone; the route no longer exists", async () => {
    const res = await patch("/privacy", { twoFactorEnabled: true });
    expect(res.status).toBe(404);
  });

  test("GET /settings - reports twoFactorEnabled (default false)", async () => {
    const data = (await (await getSettings()).json()) as any;
    expect(data.privacy).toEqual({ twoFactorEnabled: false });
  });

  // ── Section isolation ─────────────────────────────────────────

  test("PATCH sections are independent - updating one leaves the others at defaults", async () => {
    await patch("/notifications", {
      messages: false,
      sounds: false,
      alerts: false,
      emailDigest: true,
    });

    const data = (await (await getSettings()).json()) as any;
    expect(data.notifications.messages).toBe(false);
    // Untouched sections keep their defaults.
    expect(data.appearance).toEqual({ theme: "light", fontSize: "small" });
    expect(data.chat).toEqual({
      enterToSend: true,
      mediaPreview: true,
    });
    expect(data.privacy).toEqual({ twoFactorEnabled: false });
  });

  test("PATCH sections compose - two updates both stick", async () => {
    await patch("/appearance", { theme: "dark", fontSize: "small" });
    await patch("/chat", {
      enterToSend: false,
      mediaPreview: false,
    });

    const data = (await (await getSettings()).json()) as any;
    expect(data.appearance).toEqual({ theme: "dark", fontSize: "small" });
    expect(data.chat).toEqual({
      enterToSend: false,
      mediaPreview: false,
    });
  });

  test("PATCH /settings/notifications - should ignore unknown extra keys", async () => {
    const res = await patch("/notifications", {
      messages: false,
      sounds: true,
      alerts: true,
      emailDigest: false,
      isAdmin: true,
      injected: "value",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.notifications.messages).toBe(false);
    expect(data.notifications).not.toHaveProperty("isAdmin");
  });

  test("SETTINGS: garbage payloads are rejected on every PATCH route", async () => {
    const garbage = { nope: true, n: Math.random() };
    for (const path of ["/notifications", "/appearance", "/chat"]) {
      const res = await patch(path, garbage);
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error || data.message).toBeDefined();
    }
  });
});
