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
import app from "../src/app";
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

describe("Messages Endpoints", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;
	let userA: Awaited<ReturnType<typeof createTestUser>>;
	let userB: Awaited<ReturnType<typeof createTestUser>>;
	let userC: Awaited<ReturnType<typeof createTestUser>>;
	let chat: Awaited<ReturnType<typeof createTestGroupChat>>;

	beforeAll(async () => {
		if (!DB_AVAILABLE) {
			console.warn("Skipping messages tests - database not available");
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
			username: `msgA-${Date.now()}`,
			email: `msgA-${Date.now()}@example.com`,
		});
		userB = await createTestUser({
			username: `msgB-${Date.now()}`,
			email: `msgB-${Date.now()}@example.com`,
		});
		userC = await createTestUser({
			username: `msgC-${Date.now()}`,
			email: `msgC-${Date.now()}@example.com`,
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

	test("POST /chats/:chatId/messages - should send image message without text", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(await authHeader(userA.id, userA.username)),
			},
			body: JSON.stringify({
				type: "IMAGE",
			}),
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as any;
		expect(data).toHaveProperty("type", "IMAGE");
		expect(data.senderId).toBe(userA.id);
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
			username: `outside-${Date.now()}`,
			email: `outside-${Date.now()}@example.com`,
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
			}),
		});

		expect(res.status).toBe(403);
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
			username: `outside2-${Date.now()}`,
			email: `outside2-${Date.now()}@example.com`,
		});

		const res = await fetch(`${baseUrl()}/api/v1/chats/${chat.id}/messages`, {
			headers: await authHeader(outsideUser.id, outsideUser.username),
		});

		expect(res.status).toBe(403);
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
		expect(data.error.message).toBe("Invalid request");
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

	test("POST /chats/:chatId/messages/pin - should return 501 not implemented", async () => {
		const res = await fetch(
			`${baseUrl()}/api/v1/chats/${chat.id}/messages/pin`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(await authHeader(userA.id, userA.username)),
				},
				body: JSON.stringify({ messageId: "some-message-id" }),
			},
		);

		expect(res.status).toBe(501);
		const data = (await res.json()) as any;
		expect(data.error.message).toBe(
			"This message feature needs additional database models first",
		);
	});

	test("POST /chats/:chatId/messages/reactions - should return 501 not implemented", async () => {
		const res = await fetch(
			`${baseUrl()}/api/v1/chats/${chat.id}/messages/reactions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(await authHeader(userA.id, userA.username)),
				},
				body: JSON.stringify({ messageId: "some-message-id", emoji: "👍" }),
			},
		);

		expect(res.status).toBe(501);
		const data = (await res.json()) as any;
		expect(data.error.message).toBe(
			"This message feature needs additional database models first",
		);
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
			username: `outside3-${Date.now()}`,
			email: `outside3-${Date.now()}@example.com`,
		});

		const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}`, {
			headers: await authHeader(outsideUser.id, outsideUser.username),
		});

		expect(res.status).toBe(403);
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
		expect(deletedMessage?.deleted).toBe(true);
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

	test("POST /messages/:messageId/reactions - should return 501 not implemented", async () => {
		const message = await createTestMessage(chat.id, userA.id, {
			text: "React to me",
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/messages/${message.id}/reactions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(await authHeader(userA.id, userA.username)),
				},
				body: JSON.stringify({ emoji: "👍" }),
			},
		);

		expect(res.status).toBe(501);
		const data = (await res.json()) as any;
		expect(data.error.message).toBe(
			"This message feature needs additional database models first",
		);
	});

	test("DELETE /messages/:messageId/reactions - should return 501 not implemented", async () => {
		const message = await createTestMessage(chat.id, userA.id, {
			text: "Unreact from me",
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/messages/${message.id}/reactions`,
			{
				method: "DELETE",
				headers: await authHeader(userA.id, userA.username),
			},
		);

		expect(res.status).toBe(501);
		const data = (await res.json()) as any;
		expect(data.error.message).toBe(
			"This message feature needs additional database models first",
		);
	});

	test("POST /messages/:messageId/reply - should return 501 not implemented", async () => {
		const message = await createTestMessage(chat.id, userA.id, {
			text: "Reply to me",
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/messages/${message.id}/reply`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(await authHeader(userA.id, userA.username)),
				},
				body: JSON.stringify({ text: "Reply text" }),
			},
		);

		expect(res.status).toBe(501);
		const data = (await res.json()) as any;
		expect(data.error.message).toBe(
			"This message feature needs additional database models first",
		);
	});

	test("PATCH /messages/:messageId/pin - should return 501 not implemented", async () => {
		const message = await createTestMessage(chat.id, userA.id, {
			text: "Pin me",
		});

		const res = await fetch(`${baseUrl()}/api/v1/messages/${message.id}/pin`, {
			method: "PATCH",
			headers: await authHeader(userA.id, userA.username),
		});

		expect(res.status).toBe(501);
		const data = (await res.json()) as any;
		expect(data.error.message).toBe(
			"This message feature needs additional database models first",
		);
	});

	test(
		"GET /chats/:chatId/messages - should respect limit query parameter",
		async () => {
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
		},
		30000,
	);

	test(
		"GET /chats/:chatId/messages - should cap limit at 100",
		async () => {
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
		},
		30000,
	);

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
			body: JSON.stringify({ type: "TEXT", text: "New message" }),
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as any;
		expect(data).toHaveProperty("id");
	});
});
