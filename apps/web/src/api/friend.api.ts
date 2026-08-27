import type {
  SendFriendRequestResponseType,
  AcceptFriendRequestResponseType,
  RejectFriendRequestResponseType,
  CancelFriendRequestResponseType,
  GetFriendsResponseType,
  GetPendingRequestsResponseType,
  GetSuggestionsResponseType,
  RemoveFriendResponseType,
} from "@bakbak/contracts";
import { apiClient } from "./client";

export function sendFriendRequest(
  receiverId: string,
): Promise<SendFriendRequestResponseType> {
  return apiClient(`/api/v1/friends/requests/${receiverId}`, {
    method: "POST",
  });
}

export function acceptFriendRequest(
  requestId: string,
): Promise<AcceptFriendRequestResponseType> {
  return apiClient(`/api/v1/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export function rejectFriendRequest(
  requestId: string,
): Promise<RejectFriendRequestResponseType> {
  return apiClient(`/api/v1/friends/requests/${requestId}/reject`, {
    method: "POST",
  });
}

export function cancelFriendRequest(
  requestId: string,
): Promise<CancelFriendRequestResponseType> {
  return apiClient(`/api/v1/friends/requests/${requestId}`, {
    method: "DELETE",
  });
}

export function getFriends(): Promise<GetFriendsResponseType> {
  return apiClient("/api/v1/friends");
}

export function getPendingRequests(): Promise<GetPendingRequestsResponseType> {
  return apiClient("/api/v1/friends/requests");
}

export function getSuggestions(): Promise<GetSuggestionsResponseType> {
  return apiClient("/api/v1/friends/suggestions");
}

export function removeFriend(
  friendId: string,
): Promise<RemoveFriendResponseType> {
  return apiClient(`/api/v1/friends/${friendId}`, {
    method: "DELETE",
  });
}
