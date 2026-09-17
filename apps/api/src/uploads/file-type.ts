import type { AttachmentKindType as AttachmentKind } from "@bakbak/contracts";

// SVG is deliberately absent: it's an XML document that can carry script, so a
// browser rendering one stored here would run it in our origin.
const IMAGE_MIME = /^image\/(jpeg|png|gif|webp|bmp|avif)$/;
const VIDEO_MIME = /^video\/(mp4|webm|ogg|quicktime|x-matroska)$/;
const AUDIO_MIME = /^audio\/(mp3|mpeg|wav|ogg|aac|flac)$/;

/**
 * Non-media file types that are still safe to accept as chat attachments.
 * Anything not matched here (or by the media patterns above) is rejected by
 * the upload filter — notably executables.
 */
const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/rtf",
  "application/json",
]);

const EXTENSION_MAP: Record<string, AttachmentKind> = {
  png: "IMAGE",
  jpg: "IMAGE",
  jpeg: "IMAGE",
  gif: "IMAGE",
  webp: "IMAGE",
  bmp: "IMAGE",
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
  if (DOCUMENT_MIME.has(mime)) return "FILE";
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

// ── Content sniffing ────────────────────────────────────────────────────────
//
// The client's `Content-Type` is only a claim: nothing stops an executable or
// an HTML document from being posted as `image/png`. The multer filter rejects
// *unsupported declared types*; the helpers below check the bytes themselves
// agree with the declared kind before a file is stored or served.

/** ISO-BMFF (`ftyp`) brands that identify an image rather than a video. */
const FTYP_IMAGE_BRANDS = [
  "avif",
  "avis",
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
];

/** ISO-BMFF brands for the video containers we accept (MP4, QuickTime, …). */
const FTYP_VIDEO_BRANDS = [
  "qt  ",
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "dash",
  "M4V ",
  "MSNV",
  "3gp4",
  "3gp5",
];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return (
    buffer.length >= offset + bytes.length &&
    bytes.every((byte, i) => buffer[offset + i] === byte)
  );
}

function matchesAscii(buffer: Buffer, text: string, offset = 0): boolean {
  return (
    buffer.length >= offset + text.length &&
    buffer.toString("latin1", offset, offset + text.length) === text
  );
}

/** First non-whitespace byte, skipping a UTF-8 BOM. */
function firstNonWhitespace(buffer: Buffer): number {
  let i = startsWith(buffer, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (
    i < buffer.length &&
    (buffer[i] === 0x20 ||
      buffer[i] === 0x09 ||
      buffer[i] === 0x0a ||
      buffer[i] === 0x0d)
  ) {
    i += 1;
  }
  return i;
}

/**
 * The kind(s) the file's own leading bytes identify it as — an Ogg container,
 * for instance, is both audio and video until its codec is known, so more than
 * one kind can match. Empty when the bytes match nothing we recognise.
 */
export function sniffKinds(buffer: Buffer): AttachmentKind[] {
  const kinds = new Set<AttachmentKind>();

  // Images
  if (
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    kinds.add("IMAGE"); // PNG
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) kinds.add("IMAGE"); // JPEG
  if (matchesAscii(buffer, "GIF87a") || matchesAscii(buffer, "GIF89a")) {
    kinds.add("IMAGE");
  }
  if (matchesAscii(buffer, "BM")) kinds.add("IMAGE"); // BMP
  if (matchesAscii(buffer, "RIFF") && matchesAscii(buffer, "WEBP", 8)) {
    kinds.add("IMAGE");
  }

  // ISO base media (MP4/QuickTime/AVIF): byte 8 is the brand that decides.
  if (matchesAscii(buffer, "ftyp", 4)) {
    const brand = buffer.toString("latin1", 8, 12);
    if (FTYP_IMAGE_BRANDS.includes(brand)) kinds.add("IMAGE");
    else if (FTYP_VIDEO_BRANDS.includes(brand)) kinds.add("VIDEO");
  }

  // Video
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) kinds.add("VIDEO"); // Matroska/WebM
  if (matchesAscii(buffer, "RIFF") && matchesAscii(buffer, "AVI ", 8)) {
    kinds.add("VIDEO");
  }
  if (matchesAscii(buffer, "OggS")) {
    kinds.add("AUDIO");
    kinds.add("VIDEO");
  }

  // Audio
  if (matchesAscii(buffer, "ID3") || matchesAscii(buffer, "fLaC")) {
    kinds.add("AUDIO");
  }
  if (matchesAscii(buffer, "RIFF") && matchesAscii(buffer, "WAVE", 8)) {
    kinds.add("AUDIO");
  }
  // MPEG audio / AAC ADTS frame sync: eleven set bits.
  const syncHigh = buffer[0];
  const syncLow = buffer[1];
  if (syncHigh === 0xff && syncLow !== undefined && (syncLow & 0xe0) === 0xe0) {
    kinds.add("AUDIO");
  }

  // Documents
  if (matchesAscii(buffer, "%PDF-")) kinds.add("FILE");
  if (
    // ZIP, which also covers OOXML (docx/xlsx/pptx) and ODF.
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
  ) {
    kinds.add("FILE");
  }
  if (startsWith(buffer, [0x1f, 0x8b])) kinds.add("FILE"); // gzip
  if (matchesAscii(buffer, "ustar", 257)) kinds.add("FILE"); // tar
  if (matchesAscii(buffer, "{\\rtf")) kinds.add("FILE"); // RTF
  if (
    // Legacy Office (doc/xls/ppt) OLE compound file.
    startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    kinds.add("FILE");
  }
  const jsonStart = buffer[firstNonWhitespace(buffer)];
  if (jsonStart === 0x7b || jsonStart === 0x5b) kinds.add("FILE"); // JSON

  return [...kinds];
}

/** Whether the file's bytes identify it as `kind` (e.g. a real PNG for IMAGE). */
export function contentMatchesKind(
  buffer: Buffer,
  kind: AttachmentKind,
): boolean {
  return sniffKinds(buffer).includes(kind);
}
