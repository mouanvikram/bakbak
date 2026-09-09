import type { UserSettings } from "@bakbak/db";
import type {
	UpdateAppearanceDto,
	UpdateChatPreferencesDto,
	UpdateNotificationsDto,
	UserIdType,
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

	async getSettings(dto: UserIdType): Promise<UserSettingsResponseType> {
		const settings = await this.settingsRepository.upsert(dto.userId, {});

		return this.toResponse(settings);
	}

	async updateNotifications(
		dto: UpdateNotificationsDto,
	): Promise<UserSettingsResponseType> {
		return this.update(dto.userId, {
			notifyMessages: dto.settings.messages,
			notifySounds: dto.settings.sounds,
			notifyAlerts: dto.settings.alerts,
			emailDigest: dto.settings.emailDigest,
		});
	}

	async updateAppearance(
		dto: UpdateAppearanceDto,
	): Promise<UserSettingsResponseType> {
		return this.update(dto.userId, {
			theme: dto.settings.theme,
			fontSize: dto.settings.fontSize,
		});
	}

	async updateChatPreferences(
		dto: UpdateChatPreferencesDto,
	): Promise<UserSettingsResponseType> {
		return this.update(dto.userId, {
			enterToSend: dto.settings.enterToSend,
			mediaPreview: dto.settings.mediaPreview,
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
