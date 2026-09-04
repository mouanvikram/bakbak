import { z } from "zod";

export const notificationSettingsSchema = z.object({
	messages: z.boolean(),
	sounds: z.boolean(),
	alerts: z.boolean(),
	emailDigest: z.boolean(),
});

export const appearanceSettingsSchema = z.object({
	theme: z.enum(["light", "dark", "system"]),
	fontSize: z.enum(["small", "medium", "large"]),
});

export const chatPreferencesSchema = z.object({
	enterToSend: z.boolean(),
	mediaPreview: z.boolean(),
});

// Read-only: 2FA is turned on/off through the verified `/auth/2fa/*` endpoints,
// never by a plain settings PATCH.
export const privacySettingsSchema = z.object({
	twoFactorEnabled: z.boolean(),
});

export const userSettingsResponseSchema = z.object({
	notifications: notificationSettingsSchema,
	appearance: appearanceSettingsSchema,
	chat: chatPreferencesSchema,
	privacy: privacySettingsSchema,
});

export const updateNotificationSettingsRequestSchema =
	notificationSettingsSchema;
export const updateAppearanceSettingsRequestSchema = appearanceSettingsSchema;
export const updateChatPreferencesRequestSchema = chatPreferencesSchema;

export type NotificationSettingsType = z.infer<
	typeof notificationSettingsSchema
>;
export type AppearanceSettingsType = z.infer<typeof appearanceSettingsSchema>;
export type ChatPreferencesType = z.infer<typeof chatPreferencesSchema>;
export type PrivacySettingsType = z.infer<typeof privacySettingsSchema>;
export type UserSettingsResponseType = z.infer<
	typeof userSettingsResponseSchema
>;
