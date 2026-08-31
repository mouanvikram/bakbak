import { randomUUID } from "node:crypto";
import type { UploadDto } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import type { StorageProvider } from "./storage.provider";
import type { UploadRepository } from "./repository";
import {
	extensionFrom,
	kindFromExtension,
	kindFromMime,
} from "./file-type";

const SIGNED_URL_TTL_SECONDS = 3600;

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

		const url = await this.storageProvider.getSignedUrl(key, SIGNED_URL_TTL_SECONDS);

		return this.toResponse(attachment, url);
	}

	async getAttachment(attachmentId: string) {
		const attachment = await this.uploadRepository.findById(attachmentId);
		if (!attachment) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.ATTACHMENT_NOT_FOUND,
				"Attachment not found",
			);
		}

		const url = await this.storageProvider.getSignedUrl(
			attachment.filePath,
			SIGNED_URL_TTL_SECONDS,
		);

		return this.toResponse(attachment, url);
	}

	async delete(attachmentId: string, userId: string) {
		const attachment = await this.uploadRepository.findById(attachmentId);
		if (!attachment) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.ATTACHMENT_NOT_FOUND,
				"Attachment not found",
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
