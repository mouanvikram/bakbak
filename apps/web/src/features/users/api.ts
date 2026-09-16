import type {
  GetMeResponseType,
  UpdateProfileRequestType,
  UpdateProfileResponseType,
  UpdateAvatarResponseType,
  CheckUsernameResponseType,
  SearchUsersResponseType,
  GetProfileResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";

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

export async function uploadAvatar(
  blob: Blob,
  fileName: string,
): Promise<UpdateAvatarResponseType> {
  const formData = new FormData();
  formData.append("file", blob, fileName);

  // apiClient leaves Content-Type to the browser for FormData and owns the
  // expired-token refresh + redirect to /login, same as every other call.
  return apiClient("/api/v1/users/me/avatar", {
    method: "POST",
    body: formData,
  });
}

export function requestAccountDeletionChallenge(
  password: string,
): Promise<{ twoFactorRequired: boolean; message: string }> {
  return apiClient("/api/v1/users/me/delete-challenge", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function deleteMe(
  password: string,
  twoFactorCode?: string,
): Promise<{ message: string }> {
  return apiClient("/api/v1/users/me", {
    method: "DELETE",
    body: JSON.stringify({ password, twoFactorCode }),
  });
}

export function checkUsername(
  username: string,
): Promise<CheckUsernameResponseType> {
  return apiClient(
    `/api/v1/users/check-username?username=${encodeURIComponent(username)}`,
  );
}

export function searchUsers(query: string): Promise<SearchUsersResponseType> {
  return apiClient(`/api/v1/users/search?query=${encodeURIComponent(query)}`);
}

export function getProfile(username: string): Promise<GetProfileResponseType> {
  return apiClient(`/api/v1/users/${encodeURIComponent(username)}`);
}
