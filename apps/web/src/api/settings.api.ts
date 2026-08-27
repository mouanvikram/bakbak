import type {
  UserSettingsResponseType,
  NotificationSettingsType,
  AppearanceSettingsType,
  ChatPreferencesType,
  PrivacySettingsType,
} from "@bakbak/contracts";
import { apiClient } from "./client";

export function getSettings(): Promise<UserSettingsResponseType> {
  return apiClient("/api/v1/settings");
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

export function updatePrivacy(
  data: PrivacySettingsType,
): Promise<UserSettingsResponseType> {
  return apiClient("/api/v1/settings/privacy", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
