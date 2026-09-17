import { prisma, type Prisma } from "@bakbak/db";

export class UploadRepository {
  async create(data: Prisma.AttachmentUncheckedCreateInput) {
    return await prisma.attachment.create({
      data,
    });
  }

  /** Attachment bytes this user is currently storing, for the quota check. */
  async totalBytesForOwner(ownerId: string): Promise<number> {
    const { _sum } = await prisma.attachment.aggregate({
      _sum: { fileSize: true },
      where: { ownerId },
    });
    return _sum.fileSize ?? 0;
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
      include: { message: { select: { chatId: true, deletedAt: true } } },
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

  /**
   * Uploads that were never attached to a message and predate `cutoff`.
   * Avatar bookkeeping rows are excluded by key prefix — they live under
   * `avatars/` and are handled separately, since only the current one is live.
   */
  async findUnlinkedUploads(cutoff: Date) {
    return await prisma.attachment.findMany({
      where: {
        messageId: null,
        createdAt: { lt: cutoff },
        filePath: { not: { startsWith: "avatars/" } },
      },
      select: { id: true, filePath: true },
    });
  }

  /** Avatar bookkeeping rows old enough to have been replaced. */
  async findAvatarAttachments(cutoff: Date) {
    return await prisma.attachment.findMany({
      where: {
        messageId: null,
        createdAt: { lt: cutoff },
        filePath: { startsWith: "avatars/" },
      },
      select: { id: true, filePath: true },
    });
  }

  /** Storage keys still referenced as some profile's avatar. */
  async findLiveAvatarKeys(): Promise<string[]> {
    const profiles = await prisma.userProfile.findMany({
      where: { avatar: { startsWith: "avatars/" } },
      select: { avatar: true },
    });
    return profiles
      .map((profile) => profile.avatar)
      .filter((key): key is string => key !== null);
  }

  /** Attachments belonging to messages that were soft-deleted. */
  async findDeletedMessageAttachments() {
    return await prisma.attachment.findMany({
      where: { message: { deletedAt: { not: null } } },
      select: { id: true, filePath: true },
    });
  }

  async updateMessageId(id: string, messageId: string) {
    return await prisma.attachment.update({
      where: { id },
      data: { messageId },
    });
  }
}
