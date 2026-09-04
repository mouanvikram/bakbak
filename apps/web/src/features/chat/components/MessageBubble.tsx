import type { MouseEvent } from "react";
import { Check, CheckCheck } from "lucide-react";
import type { MessageResponseType } from "@bakbak/contracts";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import {
  MessageAttachments,
  MessageMedia,
} from "@/features/chat/components/MessageAttachments";

export type DeliveryStatus = "sent" | "delivered" | "seen";

/** Image and video attachments get the edge-to-edge media treatment. */
const PREVIEWABLE = new Set(["IMAGE", "VIDEO"]);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A message counts as edited once its updatedAt is meaningfully after its
 * createdAt (create-time jitter between the two columns is sub-second). */
function wasEdited(m: MessageResponseType) {
  return new Date(m.updatedAt).getTime() - new Date(m.createdAt).getTime() > 2000;
}

function StatusTick({ status }: { status: DeliveryStatus }) {
  if (status === "sent") return <Check className="size-3.5 shrink-0" />;
  return (
    <CheckCheck
      className={cn("size-3.5 shrink-0", status === "seen" && "text-sky-300")}
    />
  );
}

function Meta({
  message: m,
  mine,
  status,
  overlay,
}: {
  message: MessageResponseType;
  mine: boolean;
  status: DeliveryStatus;
  /** When set, float the meta over the media instead of sitting below the
   * bubble body. Videos use "top" so it clears the native control bar. */
  overlay?: "top" | "bottom";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px]",
        overlay
          ? cn(
              "pointer-events-none absolute right-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-white backdrop-blur-sm",
              overlay === "top" ? "top-1.5" : "bottom-1.5",
            )
          : cn("mt-0.5 justify-end", mine ? "text-white/70" : "text-gray-400"),
      )}
    >
      {!m.deleted && wasEdited(m) && <span className="italic">edited</span>}
      <span>{formatTime(m.createdAt)}</span>
      {mine && !m.deleted && <StatusTick status={status} />}
    </div>
  );
}

/**
 * One message row: optional sender header (groups), then the bubble. Image and
 * video messages render the media edge-to-edge with the time/receipt overlaid;
 * everything else keeps the padded text/attachment bubble.
 */
export function MessageBubble({
  message: m,
  mine,
  isGroup,
  isEditing,
  status,
  onContextMenu,
}: {
  message: MessageResponseType;
  mine: boolean;
  isGroup: boolean;
  isEditing: boolean;
  status: DeliveryStatus;
  onContextMenu: (e: MouseEvent) => void;
}) {
  const senderName =
    m.sender.profile?.displayName ?? m.sender.username ?? "";

  const media =
    !m.deleted &&
    m.attachments.length === 1 &&
    PREVIEWABLE.has(m.attachments[0].kind)
      ? m.attachments[0]
      : null;
  const otherAttachments = media || m.deleted ? [] : m.attachments;

  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      {!mine && isGroup && (
        <div className="mb-0.5 flex items-center gap-1.5">
          <Avatar
            name={senderName}
            src={m.sender.profile?.avatar ?? undefined}
            className="size-5"
          />
          <span className="px-1 text-[11px] font-medium text-slate-500">
            {senderName}
          </span>
        </div>
      )}

      <div
        onContextMenu={onContextMenu}
        className={cn(
          "relative max-w-[78%] overflow-hidden rounded-2xl text-sm leading-relaxed shadow-sm",
          mine
            ? "msg-bubble-out rounded-br-md text-white"
            : "rounded-bl-md bg-white text-gray-900",
          isEditing && "ring-2 ring-brand-500/60",
          media ? "w-72 max-w-[78%]" : "px-3.5 py-2",
        )}
      >
        {media ? (
          <>
            <div className="relative">
              <MessageMedia attachment={media} />
              <Meta
                message={m}
                mine={mine}
                status={status}
                overlay={media.kind === "VIDEO" ? "top" : "bottom"}
              />
            </div>
            {m.text && (
              <p className="wrap-break-words px-3 pt-1.5 pb-2 whitespace-pre-wrap">
                {m.text}
              </p>
            )}
          </>
        ) : (
          <>
            {otherAttachments.length > 0 && (
              <div className="mb-1">
                <MessageAttachments
                  attachments={otherAttachments}
                  mine={mine}
                />
              </div>
            )}
            {(m.deleted || m.text) && (
              <p className="wrap-break-words whitespace-pre-wrap">
                {m.deleted ? "This message was deleted" : m.text}
              </p>
            )}
            <Meta message={m} mine={mine} status={status} />
          </>
        )}
      </div>
    </div>
  );
}
