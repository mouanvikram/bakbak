import type { UserSettings } from "@bakbak/db";
import type {
	AppearanceSettingsType,
	ChatPreferencesType,
	NotificationSettingsType,
	UserSettingsResponseType,
} from "@bakbak/contracts";
import type { SettingsRepository } from "./repository";

type SettingsPatch = Partial<{
	notifyMessages: boolean;
	notifySounds: boolean;
	notifyAlerts: boolean;
	emailDigest: boolean;
	theme: string;
	fontSize: string;
	enterToSend: boolean;
	mediaPreview: boolean;
	twoFactorEnabled: boolean;
}>;

export class SettingsService {
	constructor(private readonly settingsRepository: SettingsRepository) {}

	async getSettings(userId: string): Promise<UserSettingsResponseType> {
		const settings = await this.settingsRepository.upsert(userId, {});

		return this.toResponse(settings);
	}

	async updateNotifications(
		userId: string,
		dto: NotificationSettingsType,
	): Promise<UserSettingsResponseType> {
		return this.update(userId, {
			notifyMessages: dto.messages,
			notifySounds: dto.sounds,
			notifyAlerts: dto.alerts,
			emailDigest: dto.emailDigest,
		});
	}

	async updateAppearance(
		userId: string,
		dto: AppearanceSettingsType,
	): Promise<UserSettingsResponseType> {
		return this.update(userId, {
			theme: dto.theme,
			fontSize: dto.fontSize,
		});
	}

	async updateChatPreferences(
		userId: string,
		dto: ChatPreferencesType,
	): Promise<UserSettingsResponseType> {
		return this.update(userId, {
			enterToSend: dto.enterToSend,
			mediaPreview: dto.mediaPreview,
		});
	}

	private async update(
		userId: string,
		patch: SettingsPatch,
	): Promise<UserSettingsResponseType> {
		const settings = await this.settingsRepository.upsert(userId, patch);

		return this.toResponse(settings);
	}

	private toResponse(settings: UserSettings): UserSettingsResponseType {
		return {
			notifications: {
				messages: settings.notifyMessages,
				sounds: settings.notifySounds,
				alerts: settings.notifyAlerts,
				emailDigest: settings.emailDigest,
			},
			appearance: {
				theme: settings.theme as "light" | "dark" | "system",
				fontSize: settings.fontSize as "small" | "medium" | "large",
			},
			chat: {
				enterToSend: settings.enterToSend,
				mediaPreview: settings.mediaPreview,
			},
			privacy: {
				twoFactorEnabled: settings.twoFactorEnabled,
			},
		};
	}
}
