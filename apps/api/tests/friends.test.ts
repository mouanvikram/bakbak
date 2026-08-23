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

describe("Friends Endpoints", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;
	let userA: Awaited<ReturnType<typeof createTestUser>>;
	let userB: Awaited<ReturnType<typeof createTestUser>>;

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
		userA = await createTestUser({
			username: `friendA-${Date.now()}`,
			email: `friendA-${Date.now()}@example.com`,
		});
		userB = await createTestUser({
			username: `friendB-${Date.now()}`,
			email: `friendB-${Date.now()}@example.com`,
		});
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	const baseUrl = () => `http://localhost:${port}`;

	test("POST /friends/requests/:receiverId - should send friend request", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${userB.id}`, {
			method: "POST",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("senderId", userA.id);
		expect(data.response).toHaveProperty("receiverId", userB.id);
		expect(data.response).toHaveProperty("status", "PENDING");
	});

	test("POST /friends/requests/:receiverId - should fail sending request to self", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${userA.id}`, {
			method: "POST",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("Invalid Id");
	});

	test("POST /friends/requests/:receiverId - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${userB.id}`, {
			method: "POST",
		});

		expect(res.status).toBe(401);
	});

	test("POST /friends/requests/:receiverId - should fail with invalid receiver id format", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/not-a-uuid`, {
			method: "POST",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("Invalid Id");
	});

	test("POST /friends/requests/:requestId/accept - should accept pending request", async () => {
		const request = await sendFriendRequest(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${request.id}/accept`, {
			method: "POST",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("id", request.id);
		expect(data.response).toHaveProperty("status", "ACCEPTED");

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

	test("POST /friends/requests/:requestId/accept - should fail for non-existent request", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/nonexistent-id/accept`, {
			method: "POST",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /friends/requests/:requestId/accept - should fail for already accepted request", async () => {
		const request = await sendFriendRequest(userA.id, userB.id);
		await prisma.friendRequest.update({
			where: { id: request.id },
			data: { status: "ACCEPTED" },
		});

		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${request.id}/accept`, {
			method: "POST",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /friends/requests/:requestId/accept - should fail without auth", async () => {
		const request = await sendFriendRequest(userA.id, userB.id);
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${request.id}/accept`, {
			method: "POST",
		});

		expect(res.status).toBe(401);
	});

	test("POST /friends/requests/:requestId/reject - should reject pending request", async () => {
		const request = await sendFriendRequest(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${request.id}/reject`, {
			method: "POST",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("id", request.id);
		expect(data.response).toHaveProperty("status", "REJECTED");
	});

	test("POST /friends/requests/:requestId/reject - should fail for non-existent request", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/nonexistent-id/reject`, {
			method: "POST",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("DELETE /friends/requests/:requestId - should cancel pending request", async () => {
		const request = await sendFriendRequest(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${request.id}`, {
			method: "DELETE",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("id", request.id);
		expect(data.response).toHaveProperty("status", "CANCELLED");
	});

	test("DELETE /friends/requests/:requestId - should fail for non-existent request", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/nonexistent-id`, {
			method: "DELETE",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
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
		const data = await res.json();
		expect(data.response).toBeDefined();
		expect(Array.isArray(data.response)).toBe(true);
		expect(data.response.length).toBe(1);
		expect(data.response[0]).toHaveProperty("friend");
		expect(data.response[0]).toHaveProperty("friendshipId");
	});

	test("GET /friends/ - should return empty array when no friends", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toBeDefined();
		expect(Array.isArray(data.response)).toBe(true);
		expect(data.response.length).toBe(0);
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
		const data = await res.json();
		expect(data).toHaveProperty("sent");
		expect(data).toHaveProperty("received");
		expect(Array.isArray(data.sent)).toBe(true);
		expect(Array.isArray(data.received)).toBe(true);
		expect(data.sent.length).toBe(1);
		expect(data.received.length).toBe(1);
	});

	test("GET /friends/requests - should return empty arrays when no requests", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.sent).toEqual([]);
		expect(data.received).toEqual([]);
	});

	test("GET /friends/requests - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/friends/requests`);

		expect(res.status).toBe(401);
	});

	test("POST /friends/requests/:receiverId - should not create duplicate pending requests", async () => {
		await sendFriendRequest(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/api/v1/friends/requests/${userB.id}`, {
			method: "POST",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});
});
