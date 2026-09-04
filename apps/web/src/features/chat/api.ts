import type {
  CreateChatRequestType,
  CreateChatResponseType,
  ListChatsResponseType,
  GetChatResponseType,
  UpdateChatRequestType,
  UpdateChatResponseType,
  DeleteChatResponseType,
  LeaveChatResponseType,
  AddParticipantRequestType,
  AddParticipantResponseType,
  RemoveParticipantResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";
import { uploadFile } from "@/lib/api/upload";

/**
 * Uploads a group photo and returns its storage key (to save on the chat)
 * plus a signed URL (to preview right away).
 */
export async function uploadGroupAvatar(
  blob: Blob,
  fileName: string,
): Promise<{ key: string; url: string }> {
  const attachment = await uploadFile(blob, fileName);
  return { key: attachment.filePath, url: attachment.url };
}

export function createDirectChat(
  data: Extract<CreateChatRequestType, { type: "DIRECT" }>,
): Promise<CreateChatResponseType> {
  return apiClient("/api/v1/chats", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createGroupChat(
  data: Extract<CreateChatRequestType, { type: "GROUP" }>,
): Promise<CreateChatResponseType> {
  return apiClient("/api/v1/chats", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listChats(): Promise<ListChatsResponseType> {
  return apiClient("/api/v1/chats");
}

export function getChat(chatId: string): Promise<GetChatResponseType> {
  return apiClient(`/api/v1/chats/${chatId}`);
}

export function updateChat(
  chatId: string,
  data: UpdateChatRequestType,
): Promise<UpdateChatResponseType> {
  return apiClient(`/api/v1/chats/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteChat(
  chatId: string,
): Promise<DeleteChatResponseType> {
  return apiClient(`/api/v1/chats/${chatId}`, {
    method: "DELETE",
  });
}

/** "Delete for me" — removes the chat from the caller's list without
 * destroying it for the other participants. */
export function leaveChat(
  chatId: string,
): Promise<LeaveChatResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/leave`, {
    method: "POST",
  });
}

export function addParticipant(
  chatId: string,
  data: AddParticipantRequestType,
): Promise<AddParticipantResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/members`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function removeParticipant(
  chatId: string,
  userId: string,
): Promise<RemoveParticipantResponseType> {
  return apiClient(`/api/v1/chats/${chatId}/members/${userId}`, {
    method: "DELETE",
  });
}
