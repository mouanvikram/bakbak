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

	// Attachment + its chat (via message), for the GET /uploads/:id access check.
	async findByIdWithChat(id: string) {
		return await prisma.attachment.findUnique({
			where: { id },
			include: { message: { select: { chatId: true, deleted: true } } },
		});
	}

	/** Is this user still an active member of the chat? */
	async isActiveChatParticipant(chatId: string, userId: string) {
		const p = await prisma.chatParticipant.findFirst({
			where: { chatId, userId, leftAt: null },
			select: { id: true },
		});
		return p !== null;
	}

	async findByFilePath(filePath: string) {
		return await prisma.attachment.findFirst({
			where: { filePath },
		});
	}

	async findManyByIds(ids: string[]) {
		return await prisma.attachment.findMany({
			where: { id: { in: ids } },
		});
	}

	async linkManyToMessage(ids: string[], messageId: string) {
		return await prisma.attachment.updateMany({
			where: { id: { in: ids } },
			data: { messageId },
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
