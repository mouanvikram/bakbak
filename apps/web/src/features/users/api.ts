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
import { apiClient } from "@/lib/api/client";
import {
  dedupeRefresh,
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from "@/lib/api/tokens";

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

export async function uploadAvatar(
  blob: Blob,
  fileName: string,
): Promise<UpdateAvatarResponseType> {
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const headers: Record<string, string> = {};
  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch("/api/v1/users/me/avatar", {
    method: "POST",
    body: formData,
    headers,
  });

  if (res.status === 401 && getRefreshToken()) {
    try {
      const newToken = await dedupeRefresh();
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch("/api/v1/users/me/avatar", {
        method: "POST",
        body: formData,
        headers,
      });
    } catch {
      clearTokens();
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error?.message ?? body.message ?? `Upload failed (${res.status})`,
    );
  }

  return res.json();
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
