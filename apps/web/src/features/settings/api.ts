import type {
  UserSettingsResponseType,
  NotificationSettingsType,
  AppearanceSettingsType,
  ChatPreferencesType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";

// The theme, chat-preference and notification providers each need this row the
// moment a session starts, and the security page asks again. Callers that ask
// while a request is already in flight share it, instead of firing one each.
let inFlight: Promise<UserSettingsResponseType> | null = null;

export function getSettings(): Promise<UserSettingsResponseType> {
  if (inFlight) return inFlight;
  inFlight = apiClient<UserSettingsResponseType>("/api/v1/settings").finally(
    () => {
      inFlight = null;
    },
  );
  return inFlight;
}

export function updateNotifications(
  data: NotificationSettingsType,
): Promise<UserSettingsResponseType> {
  return apiClient("/api/v1/settings/notifications", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateAppearance(
  data: AppearanceSettingsType,
): Promise<UserSettingsResponseType> {
  return apiClient("/api/v1/settings/appearance", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateChatPreferences(
  data: ChatPreferencesType,
): Promise<UserSettingsResponseType> {
  return apiClient("/api/v1/settings/chat", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
