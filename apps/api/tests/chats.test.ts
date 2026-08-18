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

describe("Chats Endpoints", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;
	let userA: Awaited<ReturnType<typeof createTestUser>>;
	let userB: Awaited<ReturnType<typeof createTestUser>>;
	let userC: Awaited<ReturnType<typeof createTestUser>>;

	beforeAll(async () => {
		if (!DB_AVAILABLE) {
			console.warn("Skipping chats tests - database not available");
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
			username: `chatA-${Date.now()}`,
			email: `chatA-${Date.now()}@example.com`,
		});
		userB = await createTestUser({
			username: `chatB-${Date.now()}`,
			email: `chatB-${Date.now()}@example.com`,
		});
		userC = await createTestUser({
			username: `chatC-${Date.now()}`,
			email: `chatC-${Date.now()}@example.com`,
		});
	});

	afterEach(async () => {
		await cleanupDatabase();
	});

	const baseUrl = () => `http://localhost:${port}`;

	test("POST /chats/ - should create direct chat", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "DIRECT",
				participantId: userB.id,
			}),
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.response).toHaveProperty("type", "DIRECT");
		expect(data.response).toHaveProperty("id");
		expect(data.response.participants).toHaveLength(2);
	});

	test("POST /chats/ - should create direct chat with receiverId alias", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "DIRECT",
				receiverId: userB.id,
			}),
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.response).toHaveProperty("type", "DIRECT");
	});

	test("POST /chats/ - should create direct chat with userId alias", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "DIRECT",
				userId: userB.id,
			}),
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.response).toHaveProperty("type", "DIRECT");
	});

	test("POST /chats/ - should reuse existing direct chat (idempotent)", async () => {
		await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "DIRECT",
				participantId: userB.id,
			}),
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.response).toHaveProperty("type", "DIRECT");
	});

	test("POST /chats/ - should create group chat", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "GROUP",
				name: "Test Group",
				participantIds: [userB.id, userC.id],
				avatar: "https://example.com/group-avatar.png",
			}),
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.response).toHaveProperty("type", "GROUP");
		expect(data.response).toHaveProperty("name", "Test Group");
		expect(data.response).toHaveProperty("avatar", "https://example.com/group-avatar.png");
		expect(data.response.participants).toHaveLength(3);
	});

	test("POST /chats/ - should create group chat with memberIds alias", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "GROUP",
				name: "Test Group",
				memberIds: [userB.id, userC.id],
			}),
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.response).toHaveProperty("type", "GROUP");
	});

	test("POST /chats/ - should fail creating group chat without name", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "GROUP",
				participantIds: [userB.id, userC.id],
			}),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("Group name and participant ids are required");
	});

	test("POST /chats/ - should fail creating group chat without participants", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "GROUP",
				name: "Test Group",
			}),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("Group name and participant ids are required");
	});

	test("POST /chats/ - should fail creating direct chat without participant id", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "DIRECT",
			}),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("Participant id is required");
	});

	test("POST /chats/ - should fail with invalid chat type", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "INVALID",
				participantId: userB.id,
			}),
		});

		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.message).toBe("Invalid chat type");
	});

	test("POST /chats/ - should fail creating direct chat with self", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({
				type: "DIRECT",
				participantId: userA.id,
			}),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /chats/ - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "DIRECT", participantId: userB.id }),
		});

		expect(res.status).toBe(401);
	});

	test("GET /chats/ - should list user chats", async () => {
		await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toBeDefined();
		expect(Array.isArray(data.response)).toBe(true);
		expect(data.response.length).toBeGreaterThan(0);
	});

	test("GET /chats/ - should return empty array for user with no chats", async () => {
		const res = await fetch(`${baseUrl()}/chats/`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toBeDefined();
		expect(Array.isArray(data.response)).toBe(true);
		expect(data.response.length).toBe(0);
	});

	test("GET /chats/ - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/`);

		expect(res.status).toBe(401);
	});

	test("GET /chats/:chatId - should return chat details", async () => {
		const chat = await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("id", chat.id);
		expect(data.response).toHaveProperty("type", "DIRECT");
	});

	test("GET /chats/:chatId - should return 500 for non-existent chat", async () => {
		const res = await fetch(`${baseUrl()}/chats/nonexistent-chat-id`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("GET /chats/:chatId - should fail for non-participant", async () => {
		const chat = await createTestDirectChat(userB.id, userC.id);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("GET /chats/:chatId - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/some-chat-id`);

		expect(res.status).toBe(401);
	});

	test("PATCH /chats/:chatId - should update group chat name", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({ name: "Updated Group Name" }),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("name", "Updated Group Name");
	});

	test("PATCH /chats/:chatId - should update group chat avatar", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({ avatar: "https://example.com/new-avatar.png" }),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("avatar", "https://example.com/new-avatar.png");
	});

	test("PATCH /chats/:chatId - should fail updating direct chat", async () => {
		const chat = await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({ name: "New Name" }),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("PATCH /chats/:chatId - should fail when non-admin updates group chat", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userB.id, userB.username),
			},
			body: JSON.stringify({ name: "Hacked Name" }),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("PATCH /chats/:chatId - should fail with empty name", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({ name: "   " }),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("PATCH /chats/:chatId - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/some-chat-id`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "New Name" }),
		});

		expect(res.status).toBe(401);
	});

	test("DELETE /chats/:chatId - should delete group chat by admin", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "DELETE",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toBeDefined();

		const deletedChat = await prisma.chat.findUnique({ where: { id: chat.id } });
		expect(deletedChat).toBeNull();
	});

	test("DELETE /chats/:chatId - should fail deleting direct chat", async () => {
		const chat = await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "DELETE",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("DELETE /chats/:chatId - should fail when non-admin deletes group chat", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}`, {
			method: "DELETE",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("DELETE /chats/:chatId - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/some-chat-id`, {
			method: "DELETE",
		});

		expect(res.status).toBe(401);
	});

	test("POST /chats/:chatId/members - should add participant to group chat", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}/members`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({ participantId: userC.id }),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("userId", userC.id);
		expect(data.response).toHaveProperty("role", "MEMBER");
	});

	test("POST /chats/:chatId/members - should fail adding member to direct chat", async () => {
		const chat = await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}/members`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userA.id, userA.username),
			},
			body: JSON.stringify({ participantId: userC.id }),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /chats/:chatId/members - should fail when non-admin adds member", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}/members`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...await authHeader(userB.id, userB.username),
			},
			body: JSON.stringify({ participantId: userC.id }),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /chats/:chatId/members - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/some-chat-id/members`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ participantId: userB.id }),
		});

		expect(res.status).toBe(401);
	});

	test("DELETE /chats/:chatId/members/:userId - should remove participant from group chat", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}/members/${userC.id}`, {
			method: "DELETE",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("userId", userC.id);
		expect(data.response).toHaveProperty("leftAt");
	});

	test("DELETE /chats/:chatId/members/:userId - should allow self-removal", async () => {
		const chat = await createTestGroupChat(userA.id, [userB.id, userC.id]);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}/members/${userB.id}`, {
			method: "DELETE",
			headers: await authHeader(userB.id, userB.username),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.response).toHaveProperty("userId", userB.id);
		expect(data.response).toHaveProperty("leftAt");
	});

	test("DELETE /chats/:chatId/members/:userId - should fail removing from direct chat", async () => {
		const chat = await createTestDirectChat(userA.id, userB.id);

		const res = await fetch(`${baseUrl()}/chats/${chat.id}/members/${userB.id}`, {
			method: "DELETE",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(500);
		const data = await res.json();
		expect(data.error || data.message).toBeDefined();
	});

	test("DELETE /chats/:chatId/members/:userId - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/chats/some-chat-id/members/some-user-id`, {
			method: "DELETE",
		});

		expect(res.status).toBe(401);
	});
});
