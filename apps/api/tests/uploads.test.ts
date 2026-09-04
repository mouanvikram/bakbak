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
	authHeader,
	isDatabaseAvailable,
	isStorageAvailable,
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
const STORAGE_AVAILABLE = DB_AVAILABLE && (await isStorageAvailable());

// A real 1x1 PNG.
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

describe("Uploads Endpoints", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;
	let userA: Awaited<ReturnType<typeof createTestUser>>;
	let userB: Awaited<ReturnType<typeof createTestUser>>;

	beforeAll(async () => {
		if (!DB_AVAILABLE) {
			console.warn("Skipping uploads tests - database not available");
			return;
		}
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
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});

	beforeEach(async () => {
		await cleanupDatabase();
		userA = await createTestUser({
			username: `upA-${Date.now()}`,
			email: `upA-${Date.now()}@example.com`,
		});
		userB = await createTestUser({
			username: `upB-${Date.now()}`,
			email: `upB-${Date.now()}@example.com`,
		});
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	const baseUrl = () => `http://localhost:${port}`;

	// ── Validation / auth (no storage round-trip) ───────────────────

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

	// ── Full round-trip (requires object storage) ──────────────────

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

			const res = await fetch(
				`${baseUrl()}/api/v1/uploads/${attachment.id}`,
				{ headers: await authHeader(userB.id, userB.username) },
			);

			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.attachment.id).toBe(attachment.id);
			expect(typeof body.attachment.url).toBe("string");
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

			const del = await fetch(
				`${baseUrl()}/api/v1/uploads/${attachment.id}`,
				{
					method: "DELETE",
					headers: await authHeader(userA.id, userA.username),
				},
			);
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

			const del = await fetch(
				`${baseUrl()}/api/v1/uploads/${attachment.id}`,
				{
					method: "DELETE",
					headers: await authHeader(userB.id, userB.username),
				},
			);
			expect(del.status).toBe(403);

			const row = await prisma.attachment.findUnique({
				where: { id: attachment.id },
			});
			expect(row).not.toBeNull();
		},
	);
});
