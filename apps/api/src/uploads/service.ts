import { randomUUID } from "node:crypto";
import type { AttachmentAccessDto, UploadDto } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import type { StorageProvider } from "./storage.provider";
import type { UploadRepository } from "./repository";
import {
	extensionFrom,
	kindFromExtension,
	kindFromMime,
} from "./file-type";
import { uploadsConfig } from "./config";

export class UploadService {
	constructor(
		private readonly uploadRepository: UploadRepository,
		private readonly storageProvider: StorageProvider,
	) {}

	async upload(dto: UploadDto) {
		const { userId, file } = dto;

		const kind = kindFromMime(file.mimetype) ?? kindFromExtension(extensionFrom(file.originalname));

		const key = this.buildKey(userId, file.originalname);

		await this.storageProvider.upload(key, file.buffer, file.mimetype);

		const attachment = await this.uploadRepository.create({
			kind,
			fileName: file.originalname,
			filePath: key,
			mimeType: file.mimetype,
			fileSize: file.size,
		});

		const url = await this.storageProvider.getSignedUrl(key, uploadsConfig.signedUrlTtlSeconds);

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
			duration: number | null;
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
			duration: attachment.duration,
			url,
			createdAt: attachment.createdAt.toISOString(),
		};
	}
}
