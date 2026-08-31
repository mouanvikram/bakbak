import { prisma, type Prisma, type AttachmentKind } from "@bakbak/db";

export class UploadRepository {
	async create(data: Prisma.AttachmentUncheckedCreateInput) {
		return await prisma.attachment.create({
			data,
		});
	}

	async findById(id: string) {
		return await prisma.attachment.findUnique({
			where: { id },
		});
	}

	async findByFilePath(filePath: string) {
		return await prisma.attachment.findFirst({
			where: { filePath },
		});
	}

	async deleteById(id: string) {
		return await prisma.attachment.delete({
			where: { id },
		});
	}

	async updateMessageId(id: string, messageId: string) {
		return await prisma.attachment.update({
			where: { id },
			data: { messageId },
		});
	}
}
