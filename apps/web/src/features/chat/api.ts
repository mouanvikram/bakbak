import type {
  CreateDirectChatRequestType,
  CreateGroupChatRequestType,
  CreateChatResponseType,
  ListChatsResponseType,
  GetChatResponseType,
  UpdateChatRequestType,
  UpdateChatResponseType,
  DeleteChatResponseType,
  AddParticipantRequestType,
  AddParticipantResponseType,
  RemoveParticipantResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";

export function createDirectChat(
  data: CreateDirectChatRequestType,
): Promise<CreateChatResponseType> {
  return apiClient("/api/v1/chats", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createGroupChat(
  data: CreateGroupChatRequestType,
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
