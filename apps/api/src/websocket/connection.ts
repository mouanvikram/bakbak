import type { Server, Socket } from "socket.io";
import { prisma } from "@bakbak/db";
import logger from "@/lib/logger";
import type { AuthenticatedSocket } from "./auth";

const TYPING_THROTTLE_MS = 3_000;

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// userId → set of active socket ids
const presenceMap = new Map<string, Set<string>>();
// socketId → set of chatIds the socket has joined (for presence broadcasting)
const socketChatRooms = new Map<string, Set<string>>();

let _io: Server | null = null;

export function setRefIo(io: Server) {
	_io = io;
}

export function registerConnection(io: Server, socket: AuthenticatedSocket) {
	const s = socket;
	const { userId, username } = s.data;

	logger.info({ socketId: s.id, userId, username }, "Socket connected");

	if (!presenceMap.has(userId)) {
		presenceMap.set(userId, new Set());
	}
	const userSockets = presenceMap.get(userId);
	const isFirstConnection = userSockets?.size === 0;
	userSockets?.add(s.id);

	if (isFirstConnection) {
		void markPresence(userId, true);
	}

	// Auto-join every chat the user is an active participant of.
	void joinAllChats(s, userId).then(async (chatIds) => {
		socketChatRooms.set(s.id, new Set(chatIds));
		for (const chatId of chatIds) {
			if (isFirstConnection) {
				s.to(`chat:${chatId}`).emit("presence", { userId, online: true });
			}
			// Hand this socket a snapshot of who is already online in the room,
			// so a freshly opened chat shows the correct online/offline state
			// instead of waiting for the next connect/disconnect transition.
			s.emit("presence:state", {
				chatId,
				online: await onlineUserIdsInChat(io, chatId, userId),
			});
		}
	});

	s.on("chat:join", async (chatId: unknown) => {
		if (typeof chatId !== "string") return;
		if (!(await isParticipant(chatId, userId))) return;
		void s.join(`chat:${chatId}`);
		socketChatRooms.get(s.id)?.add(chatId);

		s.to(`chat:${chatId}`).emit("presence", { userId, online: true });
		s.emit("presence:state", {
			chatId,
			online: await onlineUserIdsInChat(io, chatId, userId),
		});
	});

	s.on("chat:leave", (chatId: unknown) => {
		if (typeof chatId !== "string") return;
		void s.leave(`chat:${chatId}`);
		const rooms = socketChatRooms.get(s.id);
		if (rooms) rooms.delete(chatId);
	});

	s.on("typing", (data: unknown) => {
		const d = data as { chatId?: string; isTyping?: boolean } | undefined;
		if (!d?.chatId) return;

		const key = `${userId}:${d.chatId}`;
		const isTyping = d.isTyping ?? false;
		if (isTyping) {
			if (typingTimers.has(key)) return;
			typingTimers.set(
				key,
				setTimeout(() => typingTimers.delete(key), TYPING_THROTTLE_MS),
			);
		} else {
			// Release the throttle so the next "started typing" is delivered.
			const t = typingTimers.get(key);
			if (t) {
				clearTimeout(t);
				typingTimers.delete(key);
			}
		}

		s.to(`chat:${d.chatId}`).emit("typing", {
			chatId: d.chatId,
			userId,
			username,
			isTyping,
		});
	});

	s.on("read:receipt", async (data: unknown) => {
		const d = data as { chatId?: string; messageId?: string } | undefined;
		if (!d?.chatId || !d?.messageId) return;
		if (!(await isParticipant(d.chatId, userId))) return;

		await prisma.chatParticipant
			.updateMany({
				where: { chatId: d.chatId, userId, leftAt: null },
				data: { lastReadMessageId: d.messageId },
			})
			.catch((err: unknown) =>
				logger.error({ err }, "Failed to persist read receipt"),
			);

		s.to(`chat:${d.chatId}`).emit("read:receipt", {
			chatId: d.chatId,
			userId,
			messageId: d.messageId,
		});
	});

	s.on("disconnect", (reason) => {
		logger.info({ socketId: s.id, userId, reason }, "Socket disconnected");

		const sockets = presenceMap.get(userId);
		if (sockets) {
			sockets.delete(s.id);
			const isLast = sockets.size === 0;
			if (isLast) {
				presenceMap.delete(userId);
				void markPresence(userId, false);
				const rooms = socketChatRooms.get(s.id);
				if (rooms) {
					for (const chatId of rooms) {
						_io?.to(`chat:${chatId}`).emit("presence", {
							userId,
							online: false,
						});
					}
				}
			}
		}
		socketChatRooms.delete(s.id);

		// Clear lingering typing timers for this socket's user.
		for (const tKey of [...typingTimers.keys()]) {
			if (tKey.startsWith(`${userId}:`)) {
				clearTimeout(typingTimers.get(tKey));
				typingTimers.delete(tKey);
			}
		}
	});
}

// Coarse online/last-seen bookkeeping on the profile row. Fire-and-forget:
// a failed write must never disrupt the socket lifecycle, and a stale flag
// self-corrects on the next connect/disconnect.
async function markPresence(userId: string, online: boolean) {
	try {
		await prisma.userProfile.update({
			where: { userId },
			data: online
				? { isOnline: true }
				: { isOnline: false, lastSeenAt: new Date() },
		});
	} catch (err) {
		logger.warn({ err, userId, online }, "Failed to persist presence flag");
	}
}

// Distinct userIds currently connected to a chat room, derived from the live
// socket set rather than a hand-maintained map so it can't drift out of sync.
async function onlineUserIdsInChat(
	io: Server,
	chatId: string,
	exceptUserId?: string,
): Promise<string[]> {
	const sockets = await io.in(`chat:${chatId}`).fetchSockets();
	const ids = new Set<string>();
	for (const sk of sockets) {
		const uid = (sk.data as { userId?: string }).userId;
		if (uid && uid !== exceptUserId) ids.add(uid);
	}
	return [...ids];
}

async function joinAllChats(s: Socket, userId: string): Promise<string[]> {
	try {
		const rows = await prisma.chatParticipant.findMany({
			where: { userId, leftAt: null },
			select: { chatId: true },
		});

		const chatIds: string[] = [];
		for (const { chatId } of rows) {
			void s.join(`chat:${chatId}`);
			chatIds.push(chatId);
		}
		return chatIds;
	} catch (err) {
		logger.error({ err, userId }, "Failed to auto-join chat rooms");
		return [];
	}
}

async function isParticipant(chatId: string, userId: string): Promise<boolean> {
	try {
		const p = await prisma.chatParticipant.findUnique({
			where: { chatId_userId: { chatId, userId } },
			select: { leftAt: true },
		});
		return p !== null && p.leftAt === null;
	} catch {
		return false;
	}
}
