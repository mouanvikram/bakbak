import { prisma, Prisma } from "@bakbak/db";

export class SettingsRepository {
	async findByUserId(userId: string) {
		return prisma.userSettings.findUnique({
			where: { userId },
		});
	}

	// Creates the row with defaults on first access, applies the patch in the
	// same call — single roundtrip and no P2025 on first-time updates.
	async upsert(
		userId: string,
		data: Omit<Prisma.UserSettingsUncheckedCreateInput, "userId">,
	) {
		return prisma.userSettings.upsert({
			where: { userId },
			update: data,
			create: {
				...data,
				userId,
			},
		});
	}
}
