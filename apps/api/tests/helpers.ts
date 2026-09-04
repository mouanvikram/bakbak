import { randomUUID } from "node:crypto";
import { prisma, ParticipantRole, MessageType } from "@bakbak/db";
import type { User } from "@bakbak/db";
import {
	type AccessTokenPayload,
	JwtService,
} from "../src/auth/jwt.service";
import { storageProvider } from "../src/uploads/storage";
import { env } from "@/config";

export function authHeader(userId: string, username: string) {
	const jwtService = new JwtService(env.JWT_SECRET);
	const token = jwtService.signJwt<AccessTokenPayload>(
		{
			sub: userId,
			username,
		},
		{
			expiresIn: "15m",
		},
	);
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
					bio: overrides.bio || "This is a test bio.",
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

export async function createTestFriendship(user1Id: string, user2Id: string) {
	// Column order is normalised the same way the app does it, so lookups that
	// assume `user1Id <= user2Id` still match.
	const [a, b] = [user1Id, user2Id].sort();
	return prisma.friendship.create({ data: { user1Id: a, user2Id: b } });
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
	await prisma.attachment.deleteMany({});
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

/**
 * True when object storage (MinIO/S3) is reachable and writable. Used to gate
 * the upload tests that need a real round-trip: they run in `test:docker`
 * (where the `minio` service is up) and are skipped on a bare host.
 */
export async function isStorageAvailable(): Promise<boolean> {
	const key = `__probe__/${randomUUID()}.txt`;
	try {
		await storageProvider.upload(key, Buffer.from("probe"), "text/plain");
		await storageProvider.delete(key);
		return true;
	} catch {
		return false;
	}
}
