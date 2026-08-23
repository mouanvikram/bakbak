import { prisma, Prisma, ParticipantRole, MessageType } from "@bakbak/db";
import type { User } from "@bakbak/db";

export async function generateToken(
	userId: string,
	username: string,
): Promise<string> {
	const jwtSecret = process.env.JWT_SECRET || "test-secret";
	const payload = { sub: userId, username };
	const header = { alg: "HS256", typ: "JWT" };

	const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
		"base64url",
	);
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
		"base64url",
	);

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(jwtSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`${encodedHeader}.${encodedPayload}`),
	);
	const encodedSignature = Buffer.from(signature).toString("base64url");

	return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function authHeader(
	userId: string,
	username: string,
): Promise<Record<string, string>> {
	const token = await generateToken(userId, username);
	return { Authorization: `Bearer ${token}` };
}

export async function createTestUser(
	overrides: Partial<{
		email: string;
		username: string;
		passwordHash: string;
		isEmailVerified: boolean;
		firstName: string;
		lastName: string;
		displayName: string;
		bio: string;
		avatar: string;
	}> = {},
): Promise<User> {
	const timestamp = Date.now();
	const randomStr = Math.random().toString(36).slice(2, 8);

	const email = overrides.email || `test-${timestamp}-${randomStr}@example.com`;
	const username = overrides.username || `testuser-${timestamp}-${randomStr}`;
	const passwordHash =
		overrides.passwordHash ||
		(await Bun.password.hash("TestPass123!", {
			algorithm: "argon2id",
			timeCost: 3,
			memoryCost: 65536,
		}));

	const user = await prisma.user.create({
		data: {
			email,
			username,
			passwordHash,
			isEmailVerified: overrides.isEmailVerified ?? true,
			profile: {
				create: {
					firstName: overrides.firstName || "Test",
					lastName: overrides.lastName || "User",
					displayName: overrides.displayName || "Test User",
					bio: overrides.bio || "Test bio",
					avatar: overrides.avatar || null,
				},
			},
		},
		include: { profile: true },
	});

	return user;
}

export async function createTestGroupChat(
	creatorId: string,
	participantIds: string[],
	overrides: { name?: string; avatar?: string | null } = {},
) {
	const timestamp = Date.now();
	const name = overrides.name || `Test Group ${timestamp}`;

	return prisma.chat.create({
		data: {
			type: "GROUP",
			name,
			avatar: overrides.avatar ?? null,
			createdById: creatorId,
			participants: {
				create: [
					{ userId: creatorId, role: ParticipantRole.ADMIN },
					...participantIds.map((id) => ({
						userId: id,
						role: ParticipantRole.MEMBER,
					})),
				],
			},
		},
		include: {
			participants: { include: { user: { include: { profile: true } } } },
			messages: true,
			createdBy: true,
		},
	});
}

export async function createTestDirectChat(user1Id: string, user2Id: string) {
	const [id1, id2] = [user1Id, user2Id].sort();
	const directKey = `${id1}:${id2}`;

	return prisma.chat.upsert({
		where: { directKey },
		create: {
			type: "DIRECT",
			directKey,
			createdById: user1Id,
			participants: {
				create: [
					{ userId: user1Id, role: ParticipantRole.MEMBER },
					{ userId: user2Id, role: ParticipantRole.MEMBER },
				],
			},
		},
		update: {
			participants: {
				updateMany: {
					where: { userId: { in: [user1Id, user2Id] } },
					data: { leftAt: null },
				},
			},
		},
		include: {
			participants: { include: { user: { include: { profile: true } } } },
			messages: true,
			createdBy: true,
		},
	});
}

export async function sendFriendRequest(senderId: string, receiverId: string) {
	return prisma.friendRequest.create({
		data: {
			senderId,
			receiverId,
			status: "PENDING",
		},
		include: {
			sender: { include: { profile: true } },
			receiver: { include: { profile: true } },
		},
	});
}

export async function createTestMessage(
	chatId: string,
	senderId: string,
	overrides: { text?: string; type?: string; deleted?: boolean } = {},
) {
	return prisma.message.create({
		data: {
			chatId,
			senderId,
			type: (overrides.type as MessageType) || MessageType.TEXT,
			text: overrides.text ?? "Hello world",
			deleted: overrides.deleted ?? false,
		},
		include: {
			sender: { include: { profile: true } },
		},
	});
}

export async function cleanupDatabase() {
	await prisma.message.deleteMany({});
	await prisma.chatParticipant.deleteMany({});
	await prisma.chat.deleteMany({});
	await prisma.friendship.deleteMany({});
	await prisma.friendRequest.deleteMany({});
	await prisma.verificationToken.deleteMany({});
	await prisma.refreshToken.deleteMany({});
	await prisma.userProfile.deleteMany({});
	await prisma.user.deleteMany({});
}

export async function isDatabaseAvailable(): Promise<boolean> {
	try {
		await prisma.$queryRaw`SELECT 1`;
		return true;
	} catch {
		return false;
	}
}
