import { mock } from "bun:test";
import { beforeAll, afterAll, beforeEach, afterEach, describe, test, expect } from "bun:test";
import { createServer } from "node:http";
import app from "../src/app";
import { prisma } from "@sealchat/db";
import {
	cleanupDatabase,
	createTestUser,
	createTestDirectChat,
	createTestGroupChat,
	sendFriendRequest,
	createTestMessage,
	authHeader,
	isDatabaseAvailable,
} from "./helpers";

mock.module("resend", () => ({
	Resend: class {
		emails = {
			send: mock(() => Promise.resolve({ data: { id: "test-email-id" }, error: null })),
		};
	},
}));

const DB_AVAILABLE = await isDatabaseAvailable();

describe("Users Endpoints", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;
	let testUser: Awaited<ReturnType<typeof createTestUser>>;

	beforeAll(async () => {
		if (!DB_AVAILABLE) {
			console.warn("Skipping users tests - database not available");
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
		const data = await res.json();
		expect(data.profile).toHaveProperty("id", testUser.id);
		expect(data.profile).toHaveProperty("email", testUser.email);
		expect(data.profile).toHaveProperty("username", testUser.username);
		expect(data.profile).toHaveProperty("verified", testUser.isEmailVerified);
		expect(data.profile).toHaveProperty("firstName", "Test");
		expect(data.profile).toHaveProperty("lastName", "User");
		expect(data.profile).toHaveProperty("displayName", "Test User");
		expect(data.profile).toHaveProperty("bio", "Test bio");
		expect(data.profile).toHaveProperty("avatar", null);
	});

	test("GET /users/me - should fail without auth token", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/me`);

		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.message || data.error).toBeDefined();
	});

	test("GET /users/me - should fail with invalid auth token", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
			headers: { Authorization: "Bearer invalid-token" },
		});

		expect(res.status).toBe(401);
		const data = await res.json();
		expect(data.message || data.error).toBeDefined();
	});

	test("PATCH /users/me - should update profile with auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(testUser.id, testUser.username),
			},
			body: JSON.stringify({
				bio: "Updated bio",
				firstName: "Jane",
				lastName: "Smith",
				displayName: "Jane Smith",
			}),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("firstName", "Jane");
		expect(data.response).toHaveProperty("lastName", "Smith");
		expect(data.response).toHaveProperty("displayName", "Jane Smith");
		expect(data.response).toHaveProperty("bio", "Updated bio");
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
				...await authHeader(testUser.id, testUser.username),
			},
			body: JSON.stringify({ avatar: "https://example.com/new-avatar.png" }),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("avatar", "https://example.com/new-avatar.png");
	});

	test("PATCH /users/me/avatar - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/me/avatar`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ avatar: "https://example.com/avatar.png" }),
		});

		expect(res.status).toBe(401);
	});

	test("DELETE /users/me - should delete account with auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
			method: "DELETE",
			headers: await authHeader(testUser.id, testUser.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.message).toBe("Account Deleted successfully");

		const user = await prisma.user.findUnique({ where: { id: testUser.id } });
		expect(user).toBeNull();
	});

	test("DELETE /users/me - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/me`, {
			method: "DELETE",
		});

		expect(res.status).toBe(401);
	});

	test("GET /users/check-username - should return available for unused username", async () => {
		const username = `check-${Date.now()}`;
		const res = await fetch(`${baseUrl()}/api/v1/users/check-username?username=${username}`, {
			headers: await authHeader(testUser.id, testUser.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("available", true);
	});

	test("GET /users/check-username - should return not available for used username", async () => {
		const res = await fetch(
			`${baseUrl()}/api/v1/users/check-username?username=${encodeURIComponent(testUser.username)}`,
			{
				headers: await authHeader(testUser.id, testUser.username),
			}
		);

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("GET /users/check-username - should fail without username query param", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/check-username`, {
			headers: await authHeader(testUser.id, testUser.username),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("invalid request");
	});

	test("GET /users/search - should return matching users", async () => {
		const uniqueName = `searchable-${Date.now()}`;
		await createTestUser({
			username: uniqueName,
			firstName: "Searchable",
			lastName: "User",
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/users/search?q=${encodeURIComponent(uniqueName)}`,
			{
				headers: await authHeader(testUser.id, testUser.username),
			}
		);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.users).toBeDefined();
		expect(Array.isArray(data.users)).toBe(true);
		expect(data.users.length).toBeGreaterThan(0);
		expect(data.users[0]).toHaveProperty("username", uniqueName);
	});

	test("GET /users/search - should return empty array for no matches", async () => {
		const res = await fetch(
			`${baseUrl()}/api/v1/users/search?q=${encodeURIComponent("nonexistent-user-xyz-12345")}`,
			{
				headers: await authHeader(testUser.id, testUser.username),
			}
		);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.users).toBeDefined();
		expect(Array.isArray(data.users)).toBe(true);
		expect(data.users.length).toBe(0);
	});

	test("GET /users/search - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/search?q=test`);

		expect(res.status).toBe(401);
	});

	test("GET /users/:username - should return user profile by username", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/${encodeURIComponent(testUser.username)}`, {
			headers: await authHeader(testUser.id, testUser.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.otherUserProfile).toHaveProperty("username", testUser.username);
		expect(data.otherUserProfile).toHaveProperty("verified", testUser.isEmailVerified);
		expect(data.otherUserProfile).toHaveProperty("firstName", "Test");
		expect(data.otherUserProfile).toHaveProperty("lastName", "User");
		expect(data.otherUserProfile).toHaveProperty("displayName", "Test User");
	});

	test("GET /users/:username - should return 500 for non-existent username", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/nonexistent-user-xyz-12345`, {
			headers: await authHeader(testUser.id, testUser.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("GET /users/:username - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/users/${encodeURIComponent(testUser.username)}`);

		expect(res.status).toBe(401);
	});
});
