import type { Chat, UserSummary } from "../types/api";
import { getDisplayName } from "./utils";

export function getChatPeer(chat: Chat, currentUserId?: string | null): UserSummary | null {
  if (chat.type !== "DIRECT") return null;
  const other = chat.participants.find((p) => p.userId !== currentUserId);
  return other?.user ?? null;
}

export function getChatTitle(chat: Chat, currentUserId?: string | null) {
  if (chat.type === "GROUP") {
    return chat.name?.trim() || "Group chat";
  }
  const peer = getChatPeer(chat, currentUserId);
  return getDisplayName(peer);
}

export function getChatAvatar(chat: Chat, currentUserId?: string | null) {
  if (chat.type === "GROUP") {
    return chat.avatar ?? null;
  }
  return getChatPeer(chat, currentUserId)?.profile?.avatar ?? null;
}

export function getLastMessagePreview(chat: Chat) {
  const last = chat.messages?.[0];
  if (!last) return "No messages yet";
  if (last.type === "TEXT") return last.text || "Message";
  return last.type.charAt(0) + last.type.slice(1).toLowerCase();
}
