import { z } from "zod";
import { safeString, singleItemResponseSchema } from "./shared";

export const attachmentKindSchema = z.enum([
	"IMAGE",
	"VIDEO",
	"AUDIO",
	"FILE",
	"STICKER",
]);

export type AttachmentKindType = z.infer<typeof attachmentKindSchema>;

export const attachmentResponseSchema = z.object({
	id: z.uuid(),
	kind: attachmentKindSchema,
	fileName: safeString(255),
	filePath: safeString(1024),
	mimeType: safeString(255),
	fileSize: z.number().int().nonnegative(),
	width: z.number().int().positive().nullable(),
	height: z.number().int().positive().nullable(),
	duration: z.number().int().positive().nullable(),
	url: z.string(),
	createdAt: z.string(),
});

export type AttachmentResponseType = z.infer<typeof attachmentResponseSchema>;

export const uploadResponseSchema = singleItemResponseSchema(
	"attachment",
	attachmentResponseSchema,
);

export type UploadResponseType = z.infer<typeof uploadResponseSchema>;

export const getAttachmentResponseSchema = singleItemResponseSchema(
	"attachment",
	attachmentResponseSchema,
);

export type GetAttachmentResponseType = z.infer<
	typeof getAttachmentResponseSchema
>;


export const deleteAttachmentResponseSchema = z.object({
	id: z.uuid(),
});

export type DeleteAttachmentResponseType = z.infer<
	typeof deleteAttachmentResponseSchema
>;

export const attachmentIdParamsSchema = z.object({
	attachmentId: z.uuid(),
});

export type AttachmentIdParamsType = z.infer<typeof attachmentIdParamsSchema>;

export interface UploadFile {
	fieldname: string;
	originalname: string;
	encoding: string;
	mimetype: string;
	buffer: Buffer;
	size: number;
}

export interface UploadDto {
	userId: string;
	file: UploadFile;
}

/** Read or delete one attachment on behalf of a caller. */
export interface AttachmentAccessDto {
	attachmentId: string;
	userId: string;
}
