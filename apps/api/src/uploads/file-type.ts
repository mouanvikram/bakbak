import type { AttachmentKindType as AttachmentKind } from "@bakbak/contracts";

const IMAGE_MIME = /^image\/(jpeg|png|gif|webp|bmp|svg\+xml|avif)$/;
const VIDEO_MIME = /^video\/(mp4|webm|ogg|quicktime|x-matroska)$/;
const AUDIO_MIME = /^audio\/(mp3|mpeg|wav|ogg|aac|flac)$/;

const EXTENSION_MAP: Record<string, AttachmentKind> = {
	png: "IMAGE",
	jpg: "IMAGE",
	jpeg: "IMAGE",
	gif: "IMAGE",
	webp: "IMAGE",
	bmp: "IMAGE",
	svg: "IMAGE",
	avif: "IMAGE",
	mp4: "VIDEO",
	webm: "VIDEO",
	mov: "VIDEO",
	avi: "VIDEO",
	mkv: "VIDEO",
	mp3: "AUDIO",
	wav: "AUDIO",
	ogg: "AUDIO",
	aac: "AUDIO",
	flac: "AUDIO",
};

/** Map a MIME type to an AttachmentKind, or null when unsupported. */
export function kindFromMime(mime: string): AttachmentKind | null {
	if (IMAGE_MIME.test(mime)) return "IMAGE";
	if (VIDEO_MIME.test(mime)) return "VIDEO";
	if (AUDIO_MIME.test(mime)) return "AUDIO";
	return null;
}

/** Fallback for generic MIME types (e.g. application/octet-stream). */
export function kindFromExtension(ext: string): AttachmentKind {
	return EXTENSION_MAP[ext.toLowerCase()] ?? "FILE";
}

/** Extract a safe file extension from an original filename. */
export function extensionFrom(filename: string): string {
	const lastDot = filename.lastIndexOf(".");
	if (lastDot === -1 || lastDot === filename.length - 1) return "";
	return filename.slice(lastDot + 1);
}
