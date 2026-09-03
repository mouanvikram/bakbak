import type {
  SendMessageRequestType,
  SendMessageResponseType,
  ListMessagesResponseType,
  GetMessageResponseType,
  EditMessageRequestType,
  EditMessageResponseType,
  DeleteMessageResponseType,
  MarkChatReadRequestType,
  MarkChatReadResponseType,
  SearchMessagesResponseType,
  GetUnreadCountResponseType,
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

export function getMessage(
  messageId: string,
): Promise<GetMessageResponseType> {
  return apiClient(`/api/v1/messages/${messageId}`);
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

export function searchMessages(
  chatId: string,
  query: string,
): Promise<SearchMessagesResponseType> {
  // The API reads the query string from `q` (see messages controller).
  return apiClient(
    `/api/v1/chats/${chatId}/messages/search?q=${encodeURIComponent(query)}`,
  );
}

export function getUnreadCount(
  chatId: string,
): Promise<GetUnreadCountResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/messages/unread`);
}
