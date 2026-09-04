import type { Server } from "socket.io";
import type { MessageResponseType } from "@bakbak/contracts";

let ioRef: Server | null = null;

export function setIo(io: Server) {
	ioRef = io;
}

export function broadcastToChat(chatId: string, event: string, payload: unknown) {
	if (!ioRef) return;
	ioRef.to(`chat:${chatId}`).emit(event, payload);
}

/** Metadata change to a chat (name, photo, members). Payload is a
 * serialized chat (ChatResponseType shape). */
export function broadcastChatUpdated(chatId: string, chat: unknown) {
	broadcastToChat(chatId, "chat:updated", chat);
}

/**
 * Join a user's live sockets to a chat room, so a freshly added member
 * starts receiving that chat's events without waiting for a reconnect.
 */
export async function addUserToChatRoom(userId: string, chatId: string) {
	if (!ioRef) return;
	const sockets = await ioRef.fetchSockets();
	for (const s of sockets) {
		if ((s.data as { userId?: string }).userId === userId) {
			s.join(`chat:${chatId}`);
		}
	}
}

export function broadcastMessage(chatId: string, message: MessageResponseType) {
	broadcastToChat(chatId, "message:new", message);
}

export function broadcastMessageEdited(chatId: string, message: MessageResponseType) {
	broadcastToChat(chatId, "message:edited", message);
}

export function broadcastMessageDeleted(chatId: string, message: MessageResponseType) {
	broadcastToChat(chatId, "message:deleted", message);
}

export function broadcastReadReceipt(chatId: string, userId: string, messageId: string) {
	broadcastToChat(chatId, "read:receipt", { chatId, userId, messageId });
}
