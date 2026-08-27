import { prisma, Prisma } from "@bakbak/db";

export class SettingsRepository {
	async findByUserId(userId: string) {
		return await prisma.userSettings.findUnique({
			where: { userId },
		});
	}

	async upsert(
		userId: string,
		data: Omit<Prisma.UserSettingsUncheckedCreateInput, "userId">,
	) {
		return await prisma.userSettings.upsert({
			where: { userId },
			update: data,
			create: {
				...data,
				userId,
			},
		});
	}
}
