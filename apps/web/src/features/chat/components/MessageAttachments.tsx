import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { AttachmentResponseType } from "@bakbak/contracts";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : "";
}

/**
 * An image or video that fills the message bubble edge-to-edge — the bubble
 * clips the corners, and the timestamp overlays the bottom-right. Falls back to
 * a file chip when the media can't be loaded.
 */
export function MessageMedia({
  attachment: a,
}: {
  attachment: AttachmentResponseType;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="p-2">
        <FileChip attachment={a} mine />
      </div>
    );
  }

  if (a.kind === "VIDEO") {
    return (
      <video
        src={a.url}
        controls
        preload="metadata"
        onError={() => setBroken(true)}
        className="block max-h-96 w-full min-w-48 bg-black object-contain"
      />
    );
  }

  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="block">
      <img
        src={a.url}
        alt={a.fileName}
        loading="lazy"
        onError={() => setBroken(true)}
        className="block h-auto max-h-96 w-full object-cover"
      />
    </a>
  );
}

/**
 * Attachments inside a padded bubble: audio players, downloadable file chips,
 * and — for the rare multi-attachment message — rounded image/video previews.
 * A message whose sole attachment is an image or video uses {@link MessageMedia}
 * instead (edge-to-edge, handled by the caller).
 */
export function MessageAttachments({
  attachments,
  mine,
}: {
  attachments: AttachmentResponseType[];
  mine: boolean;
}) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {attachments.map((a) => {
        if (a.kind === "IMAGE") {
          return (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
              <img
                src={a.url}
                alt={a.fileName}
                loading="lazy"
                className="max-h-72 w-full max-w-xs rounded-lg object-cover"
              />
            </a>
          );
        }
        if (a.kind === "VIDEO") {
          return (
            <video
              key={a.id}
              src={a.url}
              controls
              preload="metadata"
              className="max-h-72 w-full max-w-xs rounded-lg bg-black"
            />
          );
        }
        if (a.kind === "AUDIO") {
          return (
            <audio
              key={a.id}
              src={a.url}
              controls
              preload="metadata"
              className="w-full max-w-xs"
            />
          );
        }
        return <FileChip key={a.id} attachment={a} mine={mine} />;
      })}
    </div>
  );
}

function FileChip({
  attachment: a,
  mine,
}: {
  attachment: AttachmentResponseType;
  mine: boolean;
}) {
  const ext = extensionOf(a.fileName);

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download={a.fileName}
      className={cn(
        "flex max-w-64 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        mine
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
          mine ? "bg-white/20 text-white" : "bg-white text-slate-500",
        )}
      >
        {ext || <FileText className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{a.fileName}</span>
        <span className={cn("text-xs", mine ? "text-white/70" : "text-slate-400")}>
          {ext ? `${ext} · ` : ""}
          {formatBytes(a.fileSize)}
        </span>
      </span>
      <Download className="size-4 shrink-0 opacity-70" />
    </a>
  );
}
