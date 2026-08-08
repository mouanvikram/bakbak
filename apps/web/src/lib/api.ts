import axios, { type AxiosError } from "axios";
import { useAuthStore } from "../stores/auth-store";
import type {
  Chat,
  FriendEntry,
  FriendRequest,
  MeProfile,
  Message,
  SearchUser,
} from "../types/api";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    if (error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes("/api/auth/");
      if (!isAuthRoute) {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined;
    return data?.message || data?.error || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ── Auth ──────────────────────────────────────────────
export async function login(identifier: string, password: string) {
  const { data } = await api.post<{
    id: string;
    username?: string;
    token: string;
  }>("/api/auth/login", { identifier, password });
  return data;
}

export async function signup(payload: {
  username: string;
  email: string;
  password: string;
  firstname?: string;
  lastname?: string;
  displayName?: string;
}) {
  const { data } = await api.post<{
    id: string;
    email: string;
    user: unknown;
  }>("/api/auth/signup", payload);
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<{ message: string }>(
    "/api/auth/forgot-password",
    { email },
  );
  return data;
}

// ── Users ─────────────────────────────────────────────
export async function getMe() {
  const { data } = await api.get<{ profile: MeProfile }>("/users/me");
  return data.profile;
}

export async function updateMe(payload: {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
}) {
  const { data } = await api.patch<{ response: MeProfile }>("/users/me", payload);
  return data.response;
}

export async function searchUsers(query: string) {
  const { data } = await api.get<{ users: SearchUser[] }>("/users/search", {
    params: { q: query },
  });
  return data.users;
}

// ── Friends ───────────────────────────────────────────
export async function getFriends() {
  const { data } = await api.get<{ response: FriendEntry[] }>("/friends");
  return data.response;
}

export async function getFriendRequests() {
  const { data } = await api.get<{
    sent: FriendRequest[];
    received: FriendRequest[];
  }>("/friends/requests");
  return data;
}

export async function sendFriendRequest(receiverId: string) {
  const { data } = await api.post<{ response: FriendRequest }>(
    `/friends/requests/${receiverId}`,
  );
  return data.response;
}

export async function acceptFriendRequest(requestId: string) {
  const { data } = await api.post<{ response: FriendRequest }>(
    `/friends/requests/${requestId}/accept`,
  );
  return data.response;
}

export async function rejectFriendRequest(requestId: string) {
  const { data } = await api.post<{ response: FriendRequest }>(
    `/friends/requests/${requestId}/reject`,
  );
  return data.response;
}

export async function cancelFriendRequest(requestId: string) {
  const { data } = await api.delete<{ response: FriendRequest }>(
    `/friends/requests/${requestId}`,
  );
  return data.response;
}

// ── Chats ─────────────────────────────────────────────
export async function listChats(params?: { limit?: number; cursor?: string }) {
  const { data } = await api.get<{ response: Chat[] }>("/chats", { params });
  return data.response;
}

export async function getChat(chatId: string) {
  const { data } = await api.get<{ response: Chat }>(`/chats/${chatId}`);
  return data.response;
}

export async function createDirectChat(participantId: string) {
  const { data } = await api.post<{ response: Chat }>("/chats", {
    type: "DIRECT",
    participantId,
  });
  return data.response;
}

export async function createGroupChat(payload: {
  name: string;
  participantIds: string[];
  avatar?: string;
}) {
  const { data } = await api.post<{ response: Chat }>("/chats", {
    type: "GROUP",
    ...payload,
  });
  return data.response;
}

export async function deleteChat(chatId: string) {
  const { data } = await api.delete<{ response: Chat }>(`/chats/${chatId}`);
  return data.response;
}

// ── Messages ──────────────────────────────────────────
export async function listMessages(
  chatId: string,
  params?: { limit?: number; cursor?: string },
) {
  const { data } = await api.get<{ response: Message[] }>(
    `/chats/${chatId}/messages`,
    { params },
  );
  return data.response;
}

export async function sendMessage(
  chatId: string,
  payload: { text: string; type?: string },
) {
  const { data } = await api.post<{ response: Message }>(
    `/chats/${chatId}/messages`,
    {
      type: payload.type ?? "TEXT",
      text: payload.text,
    },
  );
  return data.response;
}

export async function editMessage(messageId: string, text: string) {
  const { data } = await api.patch<{ response: Message }>(
    `/messages/${messageId}`,
    { text },
  );
  return data.response;
}

export async function deleteMessage(messageId: string) {
  const { data } = await api.delete<{ response: Message }>(
    `/messages/${messageId}`,
  );
  return data.response;
}

export async function markChatRead(chatId: string, messageId?: string) {
  const { data } = await api.post<{ response: unknown }>(
    `/chats/${chatId}/messages/read`,
    messageId ? { messageId } : {},
  );
  return data.response;
}

export default api;
