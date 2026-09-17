import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import { AttachmentKind } from "@bakbak/db";
import type { AttachmentAccessDto, UploadDto } from "@bakbak/contracts";
import logger from "@/lib/logger";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { StorageProvider } from "./storage.provider";
import type { UploadRepository } from "./repository";
import { extensionFrom, kindFromExtension, kindFromMime } from "./file-type";
import { uploadsConfig } from "./config";

export class UploadService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async upload(dto: UploadDto) {
    const { userId, file } = dto;

    const kind =
      kindFromMime(file.mimetype) ??
      kindFromExtension(extensionFrom(file.originalname));

    // Checked before anything is stored, so a refused upload leaves no object
    // behind. Only uploads are gated — messaging is unaffected.
    const usedBytes = await this.uploadRepository.totalBytesForOwner(userId);
    if (usedBytes + file.size > uploadsConfig.userQuotaBytes) {
      const quotaMb = Math.round(uploadsConfig.userQuotaBytes / (1024 * 1024));
      throw new AppError(
        HTTP_STATUS.PAYLOAD_TOO_LARGE,
        ERROR_CODES.STORAGE_QUOTA_EXCEEDED,
        `You've used all ${quotaMb} MB of your upload space. Delete an attachment to make room — you can still send messages.`,
      );
    }

    const key = this.buildKey(userId, file.originalname);

    await this.storageProvider.upload(key, file.buffer, file.mimetype);

    const attachment = await this.uploadRepository.create({
      kind,
      ownerId: userId,
      fileName: file.originalname,
      filePath: key,
      mimeType: file.mimetype,
      fileSize: file.size,
      ...this.imageDimensions(kind, file.buffer),
    });

    const url = await this.storageProvider.getSignedUrl(
      key,
      uploadsConfig.signedUrlTtlSeconds,
    );

    return this.toResponse(attachment, url);
  }

  // Fresh signed URL, if the requester is an active member of the attachment's
  // chat or owns a not-yet-sent upload. Otherwise 403/404.
  async getAttachment(dto: AttachmentAccessDto) {
    const { attachmentId, userId } = dto;

    const attachment =
      await this.uploadRepository.findByIdWithChat(attachmentId);
    if (!attachment) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ATTACHMENT_NOT_FOUND,
        "Attachment not found",
      );
    }

    // A soft-deleted message's attachment is gone as far as any reader is
    // concerned, chat membership included.
    if (attachment.message?.deletedAt) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ATTACHMENT_NOT_FOUND,
        "Attachment not found",
      );
    }

    const chatId = attachment.message?.chatId;
    const allowed = chatId
      ? await this.uploadRepository.isActiveChatParticipant(chatId, userId)
      : // Unattached upload: only the owner (keys are "<userId>/..." namespaced).
        attachment.filePath.startsWith(`${userId}/`);

    if (!allowed) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "You don't have access to this file",
      );
    }

    const url = await this.storageProvider.getSignedUrl(
      attachment.filePath,
      uploadsConfig.signedUrlTtlSeconds,
    );

    return this.toResponse(attachment, url);
  }

  async delete(dto: AttachmentAccessDto) {
    const { attachmentId, userId } = dto;

    const attachment = await this.uploadRepository.findById(attachmentId);
    if (!attachment) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ATTACHMENT_NOT_FOUND,
        "Attachment not found",
      );
    }

    // Keys are namespaced by userId; reject if the requester isn't the owner.
    if (!attachment.filePath.startsWith(`${userId}/`)) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.FORBIDDEN,
        "You do not have permission to delete this attachment",
      );
    }

    await this.storageProvider.delete(attachment.filePath);
    await this.uploadRepository.deleteById(attachmentId);

    return { id: attachment.id };
  }

  /**
   * Pixel size of an image, read from the file's own header — clients use it
   * to reserve the right space before the image loads. Best effort: an
   * unreadable or unsupported header simply leaves the columns null, and
   * video/audio duration still needs a media probe we don't run.
   */
  private imageDimensions(
    kind: AttachmentKind,
    buffer: Buffer,
  ): { width?: number; height?: number } {
    if (kind !== AttachmentKind.IMAGE) return {};
    try {
      const { width, height } = imageSize(buffer);
      return Number.isFinite(width) && Number.isFinite(height)
        ? { width, height }
        : {};
    } catch (error) {
      logger.warn({ err: error }, "Could not read image dimensions");
      return {};
    }
  }

  private buildKey(userId: string, originalName: string): string {
    const ext = extensionFrom(originalName);
    const stamp = randomUUID();
    return ext ? `${userId}/${stamp}.${ext}` : `${userId}/${stamp}`;
  }

  private toResponse(
    attachment: {
      id: string;
      kind: string;
      fileName: string;
      filePath: string;
      mimeType: string;
      fileSize: number;
      width: number | null;
      height: number | null;
      createdAt: Date;
    },
    url: string,
  ) {
    return {
      id: attachment.id,
      kind: attachment.kind,
      fileName: attachment.fileName,
      filePath: attachment.filePath,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      width: attachment.width,
      height: attachment.height,
      url,
      createdAt: attachment.createdAt.toISOString(),
    };
  }
}
