import type { Server } from "socket.io";
import type { MessageResponseType } from "@bakbak/contracts";

let ioRef: Server | null = null;

export function setIo(io: Server) {
	ioRef = io;
}

export function getIo(): Server {
	if (!ioRef) {
		throw new Error("Socket.IO server not initialised");
	}
	return ioRef;
}

export function broadcastToChat(chatId: string, event: string, payload: unknown) {
	if (!ioRef) return;
	ioRef.to(`chat:${chatId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
	if (!ioRef) return;
	ioRef.to(`user:${userId}`).emit(event, payload);
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

export function broadcastTyping(chatId: string, userId: string, username: string, isTyping: boolean) {
	broadcastToChat(chatId, "typing", { chatId, userId, username, isTyping });
}

export function broadcastReadReceipt(chatId: string, userId: string, messageId: string) {
	broadcastToChat(chatId, "read:receipt", { chatId, userId, messageId });
}
