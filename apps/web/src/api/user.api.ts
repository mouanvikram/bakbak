import type {
  GetMeResponseType,
  UpdateProfileRequestType,
  UpdateProfileResponseType,
  UpdateAvatarRequestType,
  UpdateAvatarResponseType,
  CheckUsernameResponseType,
  SearchUsersResponseType,
  GetProfileResponseType,
} from "@bakbak/contracts";
import { apiClient } from "./client";

export function getMe(): Promise<GetMeResponseType> {
  return apiClient("/api/v1/users/me");
}

export function updateProfile(
  data: Omit<UpdateProfileRequestType, "userId">,
): Promise<UpdateProfileResponseType> {
  return apiClient("/api/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateAvatar(
  data: Omit<UpdateAvatarRequestType, "userId">,
): Promise<UpdateAvatarResponseType> {
  return apiClient("/api/v1/users/me/avatar", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteMe(): Promise<{ message: string }> {
  return apiClient("/api/v1/users/me", { method: "DELETE" });
}

export function checkUsername(
  username: string,
): Promise<CheckUsernameResponseType> {
  return apiClient(`/api/v1/users/check-username?username=${encodeURIComponent(username)}`);
}

export function searchUsers(
  query: string,
): Promise<SearchUsersResponseType> {
  return apiClient(`/api/v1/users/search?query=${encodeURIComponent(query)}`);
}

export function getProfile(username: string): Promise<GetProfileResponseType> {
  return apiClient(`/api/v1/users/${encodeURIComponent(username)}`);
}
