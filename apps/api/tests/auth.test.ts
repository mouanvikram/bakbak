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
import crypto from "node:crypto";
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		expect(data.error.code).toBe("VALIDATION_ERROR");
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
		const header = authHeader(`user-${Date.now()}`, "testuser");

		const res = await fetch(`${baseUrl()}/api/v1/auth/change-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...header,
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

	const hashToken = (token: string) =>
		crypto.createHash("sha256").update(token).digest("hex");

	const loginAs = async (
		identifier: string,
		password = "TestPass123!",
	) => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ identifier, password }),
		});
		return (await res.json()) as any;
	};

	// ── Refresh Token ────────────────────────────────────────────────

	test("POST /api/v1/auth/login - should return a refresh token", async () => {
		const user = await createTestUser({
			email: `refreshlogin-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const data = await loginAs(user.email);

		expect(data.accessToken).toBeDefined();
		expect(data.refreshToken).toBeDefined();
		expect(typeof data.refreshToken).toBe("string");
		expect(data.refreshToken.length).toBeGreaterThan(0);
	});

	test("POST /api/v1/auth/refresh-token - should rotate tokens with valid refresh token", async () => {
		const user = await createTestUser({
			email: `refreshvalid-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const loginData = await loginAs(user.email);

		const res = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: loginData.refreshToken }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.accessToken).toBeDefined();
		expect(data.refreshToken).toBeDefined();
		expect(data.refreshToken).not.toBe(loginData.refreshToken);

		const oldHash = hashToken(loginData.refreshToken);
		const oldToken = await prisma.refreshToken.findFirst({
			where: { tokenHash: oldHash },
		});
		expect(oldToken?.revokedAt).not.toBeNull();
	});

	test("POST /api/v1/auth/refresh-token - should fail with invalid refresh token", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: "totally-fake-token" }),
		});

		expect(res.status).toBe(401);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/refresh-token - should fail with revoked refresh token", async () => {
		const user = await createTestUser({
			email: `refreshrevoked-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const loginData = await loginAs(user.email);

		const stored = await prisma.refreshToken.findFirst({
			where: { tokenHash: hashToken(loginData.refreshToken) },
		});
		await prisma.refreshToken.update({
			where: { id: stored!.id },
			data: { revokedAt: new Date() },
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: loginData.refreshToken }),
		});

		expect(res.status).toBe(401);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/refresh-token - should fail with expired refresh token", async () => {
		const user = await createTestUser({
			email: `refreshexpired-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const token = `expired-rt-${Date.now()}`;
		await prisma.refreshToken.create({
			data: {
				userId: user.id,
				tokenHash: hashToken(token),
				expiresAt: new Date(Date.now() - 1000 * 60),
			},
		});

		const res = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: token }),
		});

		expect(res.status).toBe(401);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	});

	test("POST /api/v1/auth/refresh-token - should fail without body", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(400);
		const data = (await res.json()) as any;
		expect(data.error.code).toBe("VALIDATION_ERROR");
	});

	test("POST /api/v1/auth/refresh-token - new access token should be usable", async () => {
		const user = await createTestUser({
			email: `refreshtokenusability-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const loginData = await loginAs(user.email);

		const refreshRes = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: loginData.refreshToken }),
		});

		const refreshData = (await refreshRes.json()) as any;

		const meRes = await fetch(`${baseUrl()}/api/v1/users/me`, {
			headers: { Authorization: `Bearer ${refreshData.accessToken}` },
		});

		expect(meRes.status).toBe(200);
		const meData = (await meRes.json()) as any;
		expect(meData.profile.id).toBe(user.id);
	});

	// ── Logout ───────────────────────────────────────────────────────

	test("POST /api/v1/auth/logout - should revoke all tokens without body", async () => {
		const user = await createTestUser({
			email: `logoutall-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const loginData = await loginAs(user.email);

		const res = await fetch(`${baseUrl()}/api/v1/auth/logout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${loginData.accessToken}`,
			},
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBe("Logged out successfully");

		const tokens = await prisma.refreshToken.findMany({
			where: { userId: user.id },
		});
		expect(tokens.length).toBeGreaterThan(0);
		expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
	});

	test("POST /api/v1/auth/logout - should revoke a specific refresh token", async () => {
		const user = await createTestUser({
			email: `logoutspecific-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const loginData = await loginAs(user.email);

		const res = await fetch(`${baseUrl()}/api/v1/auth/logout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${loginData.accessToken}`,
			},
			body: JSON.stringify({ refreshToken: loginData.refreshToken }),
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.message).toBe("Logged out successfully");

		const token = await prisma.refreshToken.findFirst({
			where: { tokenHash: hashToken(loginData.refreshToken) },
		});
		expect(token?.revokedAt).not.toBeNull();
	});

	test("POST /api/v1/auth/logout - revoked refresh token should not be usable", async () => {
		const user = await createTestUser({
			email: `logoutverify-${Date.now()}@example.com`,
			isEmailVerified: true,
		});

		const loginData = await loginAs(user.email);

		await fetch(`${baseUrl()}/api/v1/auth/logout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${loginData.accessToken}`,
			},
			body: JSON.stringify({ refreshToken: loginData.refreshToken }),
		});

		const refreshRes = await fetch(`${baseUrl()}/api/v1/auth/refresh-token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: loginData.refreshToken }),
		});

		expect(refreshRes.status).toBe(401);
	});

	test("POST /api/v1/auth/logout - should fail without auth", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/logout`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(401);
	});

	// ── Hardcore boundary & injection tests ─────────────────────────

	const maxUsername = "a".repeat(30);
	const overMaxUsername = "a".repeat(31);
	const maxEmail = `${"a".repeat(45)}@${"a".repeat(50)}.com`;
	const overMaxEmail = `${"a".repeat(46)}@${"a".repeat(50)}.com`;
	const maxPassword = "A1b!" + "a".repeat(124);
	const overMaxPassword = "A1b!" + "a".repeat(125);
	const maxBio = "b".repeat(500);
	const overMaxBio = "b".repeat(501);
	const maxDisplayName = "d".repeat(100);
	const overMaxDisplayName = "d".repeat(101);
	const maxIdentifier = "i".repeat(100);
	const overMaxIdentifier = "i".repeat(101);
	const maxToken = "t".repeat(100);
	const overMaxToken = "t".repeat(101);
	const maxRefreshToken = "r".repeat(255);
	const overMaxRefreshToken = "r".repeat(256);

	const nullBytePayload = "test\x00admin";
	const unicodeBomb = "\uD800".repeat(100);

	const expectValidationError = async (url: string, body: any) => {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		expect([400, 413]).toContain(res.status);
		const data = (await res.json()) as any;
		expect(data.error || data.message).toBeDefined();
	};

	test("signup - should accept max-length username (30)", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: maxUsername,
				email: `maxuser-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});
		expect(res.status).toBe(200);
	});

	test("signup - should reject username over max (31)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: overMaxUsername,
			email: `overuser-${Date.now()}@example.com`,
			password: "TestPass123!",
			firstname: "John",
			lastname: "Doe",
			displayname: "John Doe",
		});
	});

	test("signup - should accept max-length email (100)", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `maxemail-${Date.now()}`,
				email: maxEmail,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});
		expect(res.status).toBe(200);
	});

	test("signup - should reject email over max (101)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: `overemail-${Date.now()}`,
			email: overMaxEmail,
			password: "TestPass123!",
			firstname: "John",
			lastname: "Doe",
			displayname: "John Doe",
		});
	});

	test("signup - should accept max-length password (128)", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `maxpwd-${Date.now()}`,
				email: `maxpwd-${Date.now()}@example.com`,
				password: maxPassword,
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
			}),
		});
		expect(res.status).toBe(200);
	});

	test("signup - should reject password over max (129)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: `overpwd-${Date.now()}`,
			email: `overpwd-${Date.now()}@example.com`,
			password: overMaxPassword,
			firstname: "John",
			lastname: "Doe",
			displayname: "John Doe",
		});
	});

	test("signup - should accept max-length bio (500)", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `maxbio-${Date.now()}`,
				email: `maxbio-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: "John Doe",
				bio: maxBio,
			}),
		});
		expect(res.status).toBe(200);
	});

	test("signup - should reject bio over max (501)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: `overbio-${Date.now()}`,
			email: `overbio-${Date.now()}@example.com`,
			password: "TestPass123!",
			firstname: "John",
			lastname: "Doe",
			displayname: "John Doe",
			bio: overMaxBio,
		});
	});

	test("signup - should accept max-length displayname (100)", async () => {
		const res = await fetch(`${baseUrl()}/api/v1/auth/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: `maxdn-${Date.now()}`,
				email: `maxdn-${Date.now()}@example.com`,
				password: "TestPass123!",
				firstname: "John",
				lastname: "Doe",
				displayname: maxDisplayName,
			}),
		});
		expect(res.status).toBe(200);
	});

	test("signup - should reject displayname over max (101)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: `overdn-${Date.now()}`,
			email: `overdn-${Date.now()}@example.com`,
			password: "TestPass123!",
			firstname: "John",
			lastname: "Doe",
			displayname: overMaxDisplayName,
		});
	});

	test("login - should reject identifier over max (101)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/login`, {
			identifier: overMaxIdentifier,
			password: "TestPass123!",
		});
	});

	test("verify-email - should reject token over max (101)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/verify-email`, {
			token: overMaxToken,
		});
	});

	test("refresh-token - should reject refreshToken over max (256)", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/refresh-token`, {
			refreshToken: overMaxRefreshToken,
		});
	});

	test("signup - should reject null byte in username", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: nullBytePayload,
			email: `nullbyte-${Date.now()}@example.com`,
			password: "TestPass123!",
			firstname: "John",
			lastname: "Doe",
			displayname: "John Doe",
		});
	});

	test("signup - should reject unicode surrogate in username", async () => {
		await expectValidationError(`${baseUrl()}/api/v1/auth/signup`, {
			username: unicodeBomb,
			email: `unicode-${Date.now()}@example.com`,
			password: "TestPass123!",
			firstname: "John",
			lastname: "Doe",
			displayname: "John Doe",
		});
	});

	test("AUTH: break all endpoints with garbage payloads", async () => {
		const garbage = { garbage: true, random: Math.random(), nested: { deep: true } };

		const endpoints = [
			{ url: `${baseUrl()}/api/v1/auth/signup`, method: "POST", body: garbage },
			{ url: `${baseUrl()}/api/v1/auth/login`, method: "POST", body: garbage },
			{ url: `${baseUrl()}/api/v1/auth/verify-email`, method: "POST", body: garbage },
			{
				url: `${baseUrl()}/api/v1/auth/resend-verification`,
				method: "POST",
				body: garbage,
			},
			{
				url: `${baseUrl()}/api/v1/auth/forgot-password`,
				method: "POST",
				body: garbage,
			},
			{
				url: `${baseUrl()}/api/v1/auth/reset-password`,
				method: "POST",
				body: garbage,
			},
			{
				url: `${baseUrl()}/api/v1/auth/change-password`,
				method: "POST",
				body: garbage,
				headers: { Authorization: "Bearer invalid" },
			},
			{
				url: `${baseUrl()}/api/v1/auth/refresh-token`,
				method: "POST",
				body: garbage,
			},
			{
				url: `${baseUrl()}/api/v1/auth/logout`,
				method: "POST",
				body: garbage,
				headers: { Authorization: "Bearer invalid" },
			},
		];

		for (const ep of endpoints) {
			const res = await fetch(ep.url, {
				method: ep.method,
				headers: { "Content-Type": "application/json", ...ep.headers },
				body: JSON.stringify(ep.body),
			});
			expect([400, 401, 403, 413]).toContain(res.status);
		}
	});
});
