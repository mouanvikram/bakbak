import { z } from "zod";

// Mirrors apps/web/src/routes/settings pages.
// NotificationsPage
export const notificationSettingsSchema = z.object({
	messages: z.boolean(),
	sounds: z.boolean(),
	alerts: z.boolean(),
	emailDigest: z.boolean(),
});

// AppearancePage
export const appearanceSettingsSchema = z.object({
	theme: z.enum(["light", "dark", "system"]),
	fontSize: z.enum(["small", "medium", "large"]),
});

// ChatSettingsPage
export const chatPreferencesSchema = z.object({
	enterToSend: z.boolean(),
	mediaPreview: z.boolean(),
	chatHistory: z.boolean(),
});

// SecurityPrivacyPage (2FA toggle)
export const privacySettingsSchema = z.object({
	twoFactorEnabled: z.boolean(),
});

export const userSettingsResponseSchema = z.object({
	notifications: notificationSettingsSchema,
	appearance: appearanceSettingsSchema,
	chat: chatPreferencesSchema,
	privacy: privacySettingsSchema,
});

// Update payloads use the same shapes as their group in the response —
// each settings page saves its full group state on "Save Preferences".
export const updateNotificationSettingsRequestSchema =
	notificationSettingsSchema;
export const updateAppearanceSettingsRequestSchema = appearanceSettingsSchema;
export const updateChatPreferencesRequestSchema = chatPreferencesSchema;
export const updatePrivacySettingsRequestSchema = privacySettingsSchema;

export type NotificationSettingsType = z.infer<
	typeof notificationSettingsSchema
>;
export type AppearanceSettingsType = z.infer<typeof appearanceSettingsSchema>;
export type ChatPreferencesType = z.infer<typeof chatPreferencesSchema>;
export type PrivacySettingsType = z.infer<typeof privacySettingsSchema>;
export type UserSettingsResponseType = z.infer<
	typeof userSettingsResponseSchema
>;
