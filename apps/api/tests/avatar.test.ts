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
import app from "../src/app";
import { prisma } from "@bakbak/db";
import { cleanupDatabase, isDatabaseAvailable } from "./helpers";

const DB_AVAILABLE = await isDatabaseAvailable();

function pngBuffer(): Buffer {
	// Minimal 1x1 PNG
	return Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
		"base64",
	);
}

function makeForm(fileName: string, buffer: Buffer, mime: string): FormData {
	const form = new FormData();
	form.append("file", new Blob([buffer], { type: mime }), fileName);
	return form;
}

describe("Avatar pre-signup upload", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;

	beforeAll(async () => {
		if (!DB_AVAILABLE) {
			console.warn("Skipping avatar tests - database not available");
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
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	const baseUrl = () => `http://localhost:${port}`;

	test("POST /api/v1/auth/avatar - should upload a PNG without auth and return an avatarToken", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/avatar`, {
			method: "POST",
			body: makeForm("avatar.png", pngBuffer(), "image/png"),
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as any;
		expect(data.avatarToken).toBeDefined();
		expect(typeof data.avatarToken).toBe("string");
		expect(data.avatarToken.length).toBeGreaterThan(0);
	});

	test("POST /api/v1/auth/avatar - should accept JPEG and WebP", async () => {
		const cases: Array<[string, string]> = [
			["avatar.jpg", "image/jpeg"],
			["avatar.webp", "image/webp"],
		];
		for (const [file, mime] of cases) {
			const res = await fetch(`${baseUrl()}/api/v1/auth/avatar`, {
				method: "POST",
				body: makeForm(file, Buffer.from("fake"), mime),
			});
			expect(res.status).toBe(201);
			const data = (await res.json()) as any;
			expect(data.avatarToken).toBeDefined();
		}
	});

	test("POST /api/v1/auth/avatar - should reject unsupported file types", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/avatar`, {
			method: "POST",
			body: makeForm("avatar.gif", Buffer.from("fake"), "image/gif"),
		});

		expect(res.status).toBe(400);
	});

	test("POST /api/v1/auth/avatar - should reject when no file is provided", async () => {
		const form = new FormData();
		form.append("foo", "bar");
		const res = await fetch(`${baseUrl()}/api/v1/auth/avatar`, {
			method: "POST",
			body: form,
		});

		expect(res.status).toBe(400);
	});

	test("POST /api/v1/auth/avatar - should not require an auth token (pre-signup)", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/avatar`, {
			method: "POST",
			headers: { Authorization: "Bearer invalid" },
			body: makeForm("avatar.png", pngBuffer(), "image/png"),
		});

		expect(res.status).toBe(201);
	});

	test("POST /api/v1/auth/signup - should succeed with an unknown avatarToken (graceful no-op)", async () => {
		const email = `unknownavatar-${Date.now()}@example.com`;
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `unknownavatar-${Date.now()}`,
				email,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
				avatarToken: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(res.status).toBe(200);

		const created = await prisma.user.findFirst({
			where: { email },
			include: { profile: true },
		});
		expect(created?.profile?.avatar).toBeNull();
	});

	test("POST /api/v1/auth/signup - should reject a non-uuid avatarToken", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `badavatar-${Date.now()}`,
				email: `badavatar-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
				avatarToken: "not-a-uuid",
			}),
		});

		expect(res.status).toBe(400);
	});

	test("signup - uploaded avatar token is consumed and does not break account creation", async () => {
		const uploadRes = await fetch(`${baseUrl()}/api/v1/auth/avatar`, {
			method: "POST",
			body: makeForm("avatar.png", pngBuffer(), "image/png"),
		});
		expect(uploadRes.status).toBe(201);
		const { avatarToken } = (await uploadRes.json()) as any;

		const email = `avatarflow-${Date.now()}@example.com`;
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `avatarflow-${Date.now()}`,
				email,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
				avatarToken,
			}),
		});

		// Account creation must always succeed even if object storage is
		// unavailable; a failed avatar write is a graceful no-op.
		expect(res.status).toBe(200);

		const created = await prisma.user.findFirst({
			where: { email },
			include: { profile: true },
		});
		expect(created).not.toBeNull();
		expect(created?.profile).not.toBeNull();

		// A consumed token must not resolve again on a second signup.
		const second = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `avatarflow2-${Date.now()}`,
				email: `avatarflow2-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
				avatarToken,
			}),
		});
		expect(second.status).toBe(200);
	});
});
