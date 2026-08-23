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
	// generateToken,
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

describe("Auth Endpoints", () => {
	let server: ReturnType<typeof createServer>;
	let port: number;

	beforeAll(async () => {
		if (!DB_AVAILABLE) {
			console.warn("Skipping auth tests - database not available");
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

	test("POST /api/v1/auth/signup - should create a new user with valid data", async () => {
		const email = `newuser-${Date.now()}@example.com`;
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `newuser-${Date.now()}`,
				email,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
				bio: "Hello world",
				avatarUrl: "https://example.com/avatar.png",
			}),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBeDefined();

		const created = await prisma.user.findFirst({ where: { email } });
		expect(created).not.toBeNull();
	});

	test("POST /api/v1/auth/signup - should fail with short username", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "ab",
				email: `shortuser-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/signup - should fail with invalid email", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `bademail-${Date.now()}`,
				email: "not-an-email",
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/signup - should fail with weak password", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `weakpwd-${Date.now()}`,
				email: `weakpwd-${Date.now()}@example.com`,
				password: "weak",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/signup - should fail with missing firstname", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `nofirst-${Date.now()}`,
				email: `nofirst-${Date.now()}@example.com`,
				password: "TestPass123!",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/signup - should fail with duplicate email", async () => {
		const user = await createTestUser({
			email: `dup-${Date.now()}@example.com`,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `dup-${Date.now()}`,
				email: user.email,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(409);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/signup - should fail with duplicate username", async () => {
		const user = await createTestUser({ username: `dupuser-${Date.now()}` });

		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: user.username,
				email: `dupuser-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(409);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/signup - should fail with missing body fields", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/login - should login with valid credentials", async () => {
		const user = await createTestUser({
			email: `login-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: user.email,
				password: "TestPass123!",
			}),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.accessToken).toBeDefined();
		expect(typeof data.accessToken).toBe("string");
		expect(data.user.id).toBe(user.id);
		expect(data.user.identifier).toBe(user.username);
	});

	test("POST /api/v1/auth/login - should login with username as identifier", async () => {
		const user = await createTestUser({
			username: `loginuser-${Date.now()}`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: user.username,
				password: "TestPass123!",
			}),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.user.id).toBe(user.id);
	});

	test("POST /api/v1/auth/login - should fail with wrong password", async () => {
		const user = await createTestUser({
			email: `wrongpwd-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: user.email,
				password: "WrongPass123!",
			}),
		});

		expect(res.status).toBe(401);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/login - should fail with non-existent user", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: `nonexistent-${Date.now()}@example.com`,
				password: "TestPass123!",
			}),
		});

		expect(res.status).toBe(401);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/login - should fail with unverified email", async () => {
		const user = await createTestUser({
			email: `unverified-${Date.now()}@example.com`,
			isEmailVerified: false,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: user.email,
				password: "TestPass123!",
			}),
		});

		expect(res.status).toBe(403);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/login - should fail with short identifier", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: "ab",
				password: "TestPass123!",
			}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/login - should fail with weak password", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				identifier: `test-${Date.now()}@example.com`,
				password: "weak",
			}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/verify-email - should verify with valid token", async () => {
		const user = await createTestUser({
			email: `verify-${Date.now()}@example.com`,
			isEmailVerified: false,
		});

		const token = `verify-token-${Date.now()}`;
		const hashedToken = await crypto.subtle
			.digest("SHA-256", Buffer.from(token))
			.then((buf) => Buffer.from(buf).toString("hex"));

		await prisma.verificationToken.create({
			data: {
				userId: user.id,
				type: "EMAIL_VERIFICATION",
				tokenHash: hashedToken,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
			},
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/auth/verify-email?token=${token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
			},
		);

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBe("Email verified successfully");

		const updatedUser = await prisma.user.findUnique({
			where: { id: user.id },
		});
		expect(updatedUser?.isEmailVerified).toBe(true);
	});

	test("POST /api/v1/auth/verify-email - should fail with missing token", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/verify-email`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error).toBe("Validation failed");
	});

	test("POST /api/v1/auth/verify-email - should fail with invalid token", async () => {
		const res = await fetch(
			`${baseUrl()}/api/v1/auth/verify-email?token=invalid-token-12345`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
			},
		);

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/verify-email - should fail with expired token", async () => {
		const user = await createTestUser({
			email: `expired-${Date.now()}@example.com`,
			isEmailVerified: false,
		});

		const token = `expired-token-${Date.now()}`;
		const hashedToken = await crypto.subtle
			.digest("SHA-256", Buffer.from(token))
			.then((buf) => Buffer.from(buf).toString("hex"));

		await prisma.verificationToken.create({
			data: {
				userId: user.id,
				type: "EMAIL_VERIFICATION",
				tokenHash: hashedToken,
				expiresAt: new Date(Date.now() - 1000 * 60 * 60),
			},
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/auth/verify-email?token=${token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
			},
		);

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/resend-verification - should resend for valid unverified email", async () => {
		const user = await createTestUser({
			email: `resend-${Date.now()}@example.com`,
			isEmailVerified: false,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/resend-verification`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: user.email }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBeDefined();
	});

	test("POST /api/v1/auth/resend-verification - should return generic response for non-existent email", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/resend-verification`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: `nonexistent-${Date.now()}@example.com` }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBeDefined();
	});

	test("POST /api/v1/auth/resend-verification - should return generic response for already verified email", async () => {
		const user = await createTestUser({
			email: `verified-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/resend-verification`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: user.email }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBeDefined();
	});

	test("POST /api/v1/auth/change-password - should change password with valid data and auth", async () => {
		const user = await createTestUser({
			email: `changepwd-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/change-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(await authHeader(user.id, user.username)),
			},
			body: JSON.stringify({
				currentPassword: "TestPass123!",
				newPassword: "NewwPass123!",
			}),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBe("Password changed successfully");
	});

	test("POST /api/v1/auth/change-password - should fail without auth token", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/change-password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				currentPassword: "TestPass123!",
				newPassword: "NewwPass123!",
			}),
		});

		expect(res.status).toBe(401);
		const data = (await res.json()) as any;
		expect(data.message || data.error).toBeDefined();
	});

	test("POST /api/v1/auth/change-password - should fail with wrong current password", async () => {
		const user = await createTestUser({
			email: `wrongold-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/change-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeader(user.id, user.username),
			},
			body: JSON.stringify({
				currentPassword: "WrongPass123!",
				newPassword: "NewwPass123!",
			}),
		});

		expect(res.status).toBe(403);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/change-password - should fail for non-existent user", async () => {
		const token = authHeader(`user-${Date.now()}`, "testuser");

		const res = await fetch(`${baseUrl()}/api/v1/auth/change-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeader(`user-${Date.now()}`, "testuser"),
			},
			body: JSON.stringify({
				currentPassword: "TestPass123!",
				newPassword: "NewwPass123!",
			}),
		});

		expect(res.status).toBe(404);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/forgot-password - should create reset token for valid email", async () => {
		const user = await createTestUser({
			email: `forgot-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/forgot-password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: user.email }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBe(
			"If an account exists, reset link is sent to the email.",
		);

		const token = await prisma.verificationToken.findFirst({
			where: { userId: user.id, type: "PASSWORD_RESET" },
		});
		expect(token).toBeDefined();
	});

	test("POST /api/v1/auth/forgot-password - should return generic response for non-existent email", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/forgot-password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: `nonexistent-${Date.now()}@example.com` }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBeDefined();
	});

	test("POST /api/v1/auth/reset-password - should reset password with valid token", async () => {
		const user = await createTestUser({
			email: `reset-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const token = `reset-token-${Date.now()}`;
		const hashedToken = await crypto.subtle
			.digest("SHA-256", Buffer.from(token))
			.then((buf) => Buffer.from(buf).toString("hex"));

		await prisma.verificationToken.create({
			data: {
				userId: user.id,
				type: "PASSWORD_RESET",
				tokenHash: hashedToken,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
			},
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/auth/reset-password?token=${token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPassword: "NewResetPass123!" }),
			},
		);

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBe("Password reset successful");

		const updatedUser = await prisma.user.findUnique({
			where: { id: user.id },
		});
		const valid = await Bun.password.verify(
			"NewResetPass123!",
			updatedUser!.passwordHash,
		);
		expect(valid).toBe(true);
	});

	test("POST /api/v1/auth/reset-password - should fail with invalid token", async () => {
		const res = await fetch(
			`${baseUrl()}/api/v1/auth/reset-password?token=invalid-token-123`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPassword: "NewResetPass123!" }),
			},
		);

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/reset-password - should fail with expired token", async () => {
		const user = await createTestUser({
			email: `expiredreset-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const token = `expired-reset-${Date.now()}`;
		const hashedToken = await crypto.subtle
			.digest("SHA-256", Buffer.from(token))
			.then((buf) => Buffer.from(buf).toString("hex"));

		await prisma.verificationToken.create({
			data: {
				userId: user.id,
				type: "PASSWORD_RESET",
				tokenHash: hashedToken,
				expiresAt: new Date(Date.now() - 1000 * 60 * 60),
			},
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/auth/reset-password?token=${token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPassword: "NewResetPass123!" }),
			},
		);

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/reset-password - should fail without password in body", async () => {
		const user = await createTestUser({
			email: `resetnopwd-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const token = `reset-nopwd-${Date.now()}`;
		const hashedToken = await crypto.subtle
			.digest("SHA-256", Buffer.from(token))
			.then((buf) => Buffer.from(buf).toString("hex"));

		await prisma.verificationToken.create({
			data: {
				userId: user.id,
				type: "PASSWORD_RESET",
				tokenHash: hashedToken,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
			},
		});

		const res = await fetch(
			`${baseUrl()}/api/v1/auth/reset-password?token=${token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
		);

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/signup - should handle optional bio and avatarUrl", async () => {
		const email = `optional-${Date.now()}@example.com`;
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `optional-${Date.now()}`,
				email,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBeDefined();

		const created = await prisma.user.findFirst({
			where: { email },
			include: { profile: true },
		});
		expect(created?.profile?.bio).toBeNull();
		expect(created?.profile?.avatar).toBeNull();
	});
});
