import type {
  SendMessageRequestType,
  SendMessageResponseType,
  ListMessagesResponseType,
  EditMessageRequestType,
  EditMessageResponseType,
  DeleteMessageResponseType,
  MarkChatReadRequestType,
  MarkChatReadResponseType,
  GetUnreadCountResponseType,
  MessageResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";

export function sendMessage(
  chatId: string,
  data: SendMessageRequestType,
): Promise<SendMessageResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Add a reaction, or remove it if the caller already used that emoji. */
export function toggleReaction(
  chatId: string,
  messageId: string,
  emoji: string,
): Promise<MessageResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/messages/${messageId}/reactions`, {
    method: "PUT",
    body: JSON.stringify({ emoji }),
  });
}

export function listMessages(
  chatId: string,
  params?: { limit?: number; cursor?: string },
): Promise<ListMessagesResponseType> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  const qs = searchParams.toString();
  return apiClient(`/api/v1/chats/${chatId}/messages${qs ? `?${qs}` : ""}`);
}

export function editMessage(
  messageId: string,
  data: EditMessageRequestType,
): Promise<EditMessageResponseType> {
  return apiClient(`/api/v1/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMessage(
  messageId: string,
): Promise<DeleteMessageResponseType> {
  return apiClient(`/api/v1/messages/${messageId}`, {
    method: "DELETE",
  });
}

export function markChatRead(
  chatId: string,
  data?: MarkChatReadRequestType,
): Promise<MarkChatReadResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/messages/read`, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
}

export function getUnreadCount(
  chatId: string,
): Promise<GetUnreadCountResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/messages/unread`);
}
