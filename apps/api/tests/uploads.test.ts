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
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@bakbak/db";
import {
  cleanupDatabase,
  createTestUser,
  createTestDirectChat,
  createTestMessage,
  authHeader,
  isDatabaseAvailable,
  isStorageAvailable,
} from "./helpers";
import { uploadsConfig } from "@/uploads/config";

const DB_AVAILABLE = await isDatabaseAvailable();
const STORAGE_AVAILABLE = DB_AVAILABLE && (await isStorageAvailable());

const pngBuffer = () =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
    "base64",
  );

function form(fileName: string, buffer: Buffer, mime: string): FormData {
  const f = new FormData();
  f.append("file", new Blob([buffer], { type: mime }), fileName);
  return f;
}

describe.skipIf(!DB_AVAILABLE)("Uploads Endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    if (!STORAGE_AVAILABLE) {
      console.warn(
        "Object storage not reachable - upload round-trip tests will be skipped (run via `test:docker`)",
      );
    }
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    port = typeof address === "string" ? parseInt(address) : address!.port;
  });

  afterAll(async () => {
    if (server) {
      // Uploads rejected before their multipart body is read (400/403/413)
      // can leave keep-alive sockets open, and close() waits on every open
      // socket — drop them first so teardown can't hang on timing.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    await cleanupDatabase();
    userA = await createTestUser({
      username: `upA.${Date.now()}`,
      email: `upA.${Date.now()}@example.com`,
    });
    userB = await createTestUser({
      username: `upB.${Date.now()}`,
      email: `upB.${Date.now()}@example.com`,
    });
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  const baseUrl = () => `http://localhost:${port}`;

  // â”€â”€ Validation / auth (no storage round-trip) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  test("POST /uploads - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      body: form("a.png", pngBuffer(), "image/png"),
    });
    expect(res.status).toBe(401);
  });

  test("POST /uploads - should reject a request with no file", async () => {
    const empty = new FormData();
    empty.append("notafile", "x");
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: empty,
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("POST /uploads - should reject an unsupported file type", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form("evil.exe", Buffer.from("MZ"), "application/x-msdownload"),
    });
    expect(res.status).toBe(400);
  });

  test("POST /uploads - rejects content that doesn't match the declared image type", async () => {
    // A Windows executable body sent as image/png: the declared MIME passes the
    // filter, but the magic bytes must too.
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form("photo.png", Buffer.from("MZ\x90\x00\x03"), "image/png"),
    });
    expect(res.status).toBe(400);
  });

  test("POST /uploads - rejects an SVG (script-bearing XML)", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form("image.svg", Buffer.from(svg), "image/svg+xml"),
    });
    expect(res.status).toBe(400);
  });

  test("POST /uploads - rejects HTML sent as text/html", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form("page.html", Buffer.from("<script>alert(1)</script>"), "text/html"),
    });
    expect(res.status).toBe(400);
  });

  test("GET /uploads/:attachmentId - should 400 for a malformed id", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads/not-a-uuid`, {
      headers: await authHeader(userA.id, userA.username),
    });
    expect(res.status).toBe(400);
  });

  test("GET /uploads/:attachmentId - should 404 for an unknown attachment", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads/${randomUUID()}`, {
      headers: await authHeader(userA.id, userA.username),
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error || data.message).toBeDefined();
  });

  test("GET /uploads/:attachmentId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads/${randomUUID()}`);
    expect(res.status).toBe(401);
  });

  // â”€â”€ Access control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const seedAttachment = (data: {
    ownerId: string;
    messageId?: string | null;
  }) =>
    prisma.attachment.create({
      data: {
        kind: "IMAGE",
        fileName: "x.png",
        filePath: `${data.ownerId}/${randomUUID()}.png`,
        mimeType: "image/png",
        fileSize: 10,
        messageId: data.messageId ?? null,
      },
    });

  test("GET /uploads/:attachmentId - a chat member can fetch a message's attachment", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);
    const msg = await createTestMessage(chat.id, userA.id, { type: "IMAGE" });
    const att = await seedAttachment({ ownerId: userA.id, messageId: msg.id });

    const res = await fetch(`${baseUrl()}/api/v1/uploads/${att.id}`, {
      headers: await authHeader(userB.id, userB.username),
    });
    expect(res.status).toBe(200);
    expect(typeof ((await res.json()) as any).attachment.url).toBe("string");
  });

  test("GET /uploads/:attachmentId - a non-member is refused (403)", async () => {
    const chat = await createTestDirectChat(userA.id, userB.id);
    const msg = await createTestMessage(chat.id, userA.id, { type: "IMAGE" });
    const att = await seedAttachment({ ownerId: userA.id, messageId: msg.id });

    const outsider = await createTestUser({
      username: `out.${Date.now()}`,
      email: `out.${Date.now()}@example.com`,
    });
    const res = await fetch(`${baseUrl()}/api/v1/uploads/${att.id}`, {
      headers: await authHeader(outsider.id, outsider.username),
    });
    expect(res.status).toBe(403);
  });

  test("GET /uploads/:attachmentId - an unsent upload is only readable by its owner", async () => {
    const att = await seedAttachment({ ownerId: userA.id, messageId: null });

    const mine = await fetch(`${baseUrl()}/api/v1/uploads/${att.id}`, {
      headers: await authHeader(userA.id, userA.username),
    });
    expect(mine.status).toBe(200);

    const theirs = await fetch(`${baseUrl()}/api/v1/uploads/${att.id}`, {
      headers: await authHeader(userB.id, userB.username),
    });
    expect(theirs.status).toBe(403);
  });

  test("DELETE /uploads/:attachmentId - should 400 for a malformed id", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads/not-a-uuid`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /uploads/:attachmentId - should 404 for an unknown attachment", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads/${randomUUID()}`, {
      method: "DELETE",
      headers: await authHeader(userA.id, userA.username),
    });
    expect(res.status).toBe(404);
  });

  test("DELETE /uploads/:attachmentId - should fail without auth", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads/${randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  // â”€â”€ Size caps and quota â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Every limit is enforced before the bytes reach object storage, so these
  // need no MinIO — a rejected upload never gets that far.

  /** Real magic bytes followed by padding: sniffing only reads the header, so
   *  this is a valid file of whatever size we ask for. */
  const paddedTo = (header: Buffer, bytes: number) =>
    Buffer.concat([header, Buffer.alloc(Math.max(0, bytes - header.length))]);

  /** ISO-BMFF header: length, `ftyp` at offset 4, an accepted brand at 8. */
  const mp4Header = () => Buffer.from("\x00\x00\x00\x18ftypisom", "latin1");

  test("POST /uploads - rejects a non-video over the 3 MB attachment cap", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form(
        "big.png",
        paddedTo(pngBuffer(), uploadsConfig.maxFileSize + 1024),
        "image/png",
      ),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe("FILE_TOO_LARGE");
  });

  test("POST /uploads - a video of the same size clears the attachment cap", async () => {
    // The distinguishing case: identical byte count, different kind. Video is
    // allowed 20 MB, so this must not be refused for being too large.
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form(
        "clip.mp4",
        paddedTo(mp4Header(), uploadsConfig.maxFileSize + 1024),
        "video/mp4",
      ),
    });

    if (res.status !== 201) {
      // Without object storage the send fails later, on the store itself —
      // never with the size error this test is about.
      expect(((await res.json()) as any).error?.code).not.toBe(
        "FILE_TOO_LARGE",
      );
    }
  });

  test("POST /uploads - rejects a video over the 20 MB video cap", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form(
        "huge.mp4",
        paddedTo(mp4Header(), uploadsConfig.maxVideoSize + 1024),
        "video/mp4",
      ),
    });

    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe("FILE_TOO_LARGE");
  });

  test("POST /uploads - refuses an upload once the user is at their storage quota", async () => {
    // Seeded rather than uploaded: the quota sums stored bytes, so a single
    // row standing in for 100 MB exercises the check without moving 100 MB.
    await prisma.attachment.create({
      data: {
        kind: "IMAGE",
        ownerId: userA.id,
        fileName: "already-stored.png",
        filePath: `${userA.id}/${randomUUID()}.png`,
        mimeType: "image/png",
        fileSize: uploadsConfig.userQuotaBytes,
      },
    });

    const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userA.id, userA.username),
      body: form("one-more.png", pngBuffer(), "image/png"),
    });

    expect(res.status).toBe(413);
    expect(((await res.json()) as any).error.code).toBe(
      "STORAGE_QUOTA_EXCEEDED",
    );

    // The quota is per account: userB is unaffected by userA filling theirs.
    const other = await fetch(`${baseUrl()}/api/v1/uploads`, {
      method: "POST",
      headers: await authHeader(userB.id, userB.username),
      body: form("mine.png", pngBuffer(), "image/png"),
    });
    expect(other.status).not.toBe(413);
  });

  // â”€â”€ Full round-trip (requires object storage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  test.skipIf(!STORAGE_AVAILABLE)(
    "POST /uploads - should store an image and return the attachment",
    async () => {
      const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
        body: form("photo.png", pngBuffer(), "image/png"),
      });

      expect(res.status).toBe(201);
      const { attachment } = (await res.json()) as any;
      expect(attachment.id).toBeDefined();
      expect(attachment.kind).toBe("IMAGE");
      expect(attachment.mimeType).toBe("image/png");
      expect(attachment.fileName).toBe("photo.png");
      expect(attachment.filePath.startsWith(`${userA.id}/`)).toBe(true);
      expect(typeof attachment.url).toBe("string");
      expect(attachment.url.length).toBeGreaterThan(0);

      const row = await prisma.attachment.findUnique({
        where: { id: attachment.id },
      });
      expect(row).not.toBeNull();
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "POST /uploads - should classify audio by mime type",
    async () => {
      const res = await fetch(`${baseUrl()}/api/v1/uploads`, {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
        body: form("clip.mp3", Buffer.from("ID3fake"), "audio/mpeg"),
      });

      expect(res.status).toBe(201);
      const { attachment } = (await res.json()) as any;
      expect(attachment.kind).toBe("AUDIO");
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "GET /uploads/:attachmentId - should return a stored attachment with a fresh url",
    async () => {
      const upload = await fetch(`${baseUrl()}/api/v1/uploads`, {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
        body: form("photo.png", pngBuffer(), "image/png"),
      });
      const { attachment } = (await upload.json()) as any;

      // An unsent upload is readable only by its owner (see the sibling
      // test); fetching it back should hand the owner a fresh signed URL.
      const res = await fetch(`${baseUrl()}/api/v1/uploads/${attachment.id}`, {
        headers: await authHeader(userA.id, userA.username),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.attachment.id).toBe(attachment.id);
      expect(typeof body.attachment.url).toBe("string");
    },
  );

  test.skipIf(!STORAGE_AVAILABLE || Boolean(uploadsConfig.publicUrl))(
    "objects are only reachable through a signed URL, never an anonymous GET",
    async () => {
      // (Skipped when STORAGE_PUBLIC_URL is configured: in that mode objects
      // are served from a public CDN origin by design.)
      const bytes = pngBuffer();
      const upload = await fetch(`${baseUrl()}/api/v1/uploads`, {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
        body: form("photo.png", bytes, "image/png"),
      });
      const { attachment } = (await upload.json()) as any;

      // The plain object URL, exactly as a reader who knew the key would hit
      // it without a signature. A private bucket must refuse it.
      const plain = `http://${uploadsConfig.endpoint}:${uploadsConfig.port}/${uploadsConfig.bucket}/${attachment.filePath}`;
      const unsigned = await fetch(plain);
      expect(unsigned.status).toBe(403);

      // The signed URL the API hands out still works and serves the bytes.
      const signed = await fetch(attachment.url);
      expect(signed.status).toBe(200);
      expect(new Uint8Array(await signed.arrayBuffer())).toEqual(
        new Uint8Array(bytes),
      );
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "DELETE /uploads/:attachmentId - owner can delete, then it is gone",
    async () => {
      const upload = await fetch(`${baseUrl()}/api/v1/uploads`, {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
        body: form("photo.png", pngBuffer(), "image/png"),
      });
      const { attachment } = (await upload.json()) as any;

      const del = await fetch(`${baseUrl()}/api/v1/uploads/${attachment.id}`, {
        method: "DELETE",
        headers: await authHeader(userA.id, userA.username),
      });
      expect(del.status).toBe(200);
      expect(((await del.json()) as any).id).toBe(attachment.id);

      const after = await fetch(
        `${baseUrl()}/api/v1/uploads/${attachment.id}`,
        { headers: await authHeader(userA.id, userA.username) },
      );
      expect(after.status).toBe(404);
    },
  );

  test.skipIf(!STORAGE_AVAILABLE)(
    "DELETE /uploads/:attachmentId - a non-owner cannot delete someone else's attachment",
    async () => {
      const upload = await fetch(`${baseUrl()}/api/v1/uploads`, {
        method: "POST",
        headers: await authHeader(userA.id, userA.username),
        body: form("photo.png", pngBuffer(), "image/png"),
      });
      const { attachment } = (await upload.json()) as any;

      const del = await fetch(`${baseUrl()}/api/v1/uploads/${attachment.id}`, {
        method: "DELETE",
        headers: await authHeader(userB.id, userB.username),
      });
      expect(del.status).toBe(403);

      const row = await prisma.attachment.findUnique({
        where: { id: attachment.id },
      });
      expect(row).not.toBeNull();
    },
  );
});
