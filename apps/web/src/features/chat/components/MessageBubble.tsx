import { useState, type MouseEvent } from "react";
import { Check, CheckCheck, Reply, Smile } from "lucide-react";
import type { MessageResponseType } from "@bakbak/contracts";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { EmojiPopover } from "@/features/chat/components/EmojiPopover";
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
  return (
    new Date(m.updatedAt).getTime() - new Date(m.createdAt).getTime() > 2000
  );
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
}: {
  message: MessageResponseType;
  mine: boolean;
  status: DeliveryStatus;
}) {
  return (
    <div className="flex items-center gap-1 px-1 text-[10px] text-gray-400">
      {!m.deleted && wasEdited(m) && <span className="italic">edited</span>}
      <span>{formatTime(m.createdAt)}</span>
      {mine && !m.deleted && <StatusTick status={status} />}
    </div>
  );
}

/** Text shown for the answered message inside a reply quote. */
function replySummary(m: MessageResponseType) {
  if (m.deleted) return "This message was deleted";
  const text = m.text?.trim();
  if (text) return text;
  const attachment = m.attachments[0];
  if (!attachment) return "Message";
  switch (attachment.kind) {
    case "IMAGE":
      return "Photo";
    case "VIDEO":
      return "Video";
    case "AUDIO":
      return "Voice message";
    default:
      return "Attachment";
  }
}

/** The compact "answering this" strip pinned to the top of a bubble. */
function ReplyPreview({
  message: m,
  mine,
  isMine,
}: {
  message: MessageResponseType;
  mine: boolean;
  isMine: boolean;
}) {
  const name = isMine
    ? "You"
    : m.sender.profile?.displayName ?? m.sender.username ?? "Unknown";
  return (
    <div
      className={cn(
        "rounded-md p-2",
        mine ? "bg-white/15" : "bg-slate-100",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold",
          mine ? "text-white/90" : "text-slate-500",
        )}
      >
        <Reply className="size-3 shrink-0" />
        <span className="truncate">{name}</span>
      </div>
      <p
        className={cn(
          "mt-0.5 truncate text-xs",
          mine ? "text-white/70" : "text-slate-600",
        )}
      >
        {replySummary(m)}
      </p>
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
  mediaPreview = true,
  onContextMenu,
  currentUserId,
  onReaction,
}: {
  message: MessageResponseType;
  mine: boolean;
  isGroup: boolean;
  isEditing: boolean;
  status: DeliveryStatus;
  /** When false, images/videos render as download chips instead of inline. */
  mediaPreview?: boolean;
  onContextMenu: (e: MouseEvent) => void;
  currentUserId: string;
  /** Toggles an emoji on this message (add, or remove if already used). */
  onReaction?: (emoji: string) => void;
}) {
  const senderName = m.sender.profile?.displayName ?? m.sender.username ?? "";
  const [emojiOpen, setEmojiOpen] = useState(false);

  const media =
    mediaPreview &&
    !m.deleted &&
    m.attachments.length === 1 &&
    PREVIEWABLE.has(m.attachments[0].kind)
      ? m.attachments[0]
      : null;
  const otherAttachments = media || m.deleted ? [] : m.attachments;

  // Aggregate reactions per emoji, tracking whether the current user took part.
  const reactionGroups = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of m.reactions ?? []) {
    const group = reactionGroups.get(reaction.emoji) ?? {
      count: 0,
      mine: false,
    };
    group.count += 1;
    if (reaction.userId === currentUserId) group.mine = true;
    reactionGroups.set(reaction.emoji, group);
  }

  const addReaction = (emoji: string) => {
    setEmojiOpen(false);
    onReaction?.(emoji);
  };

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
          isEditing && "ring-brand-500/60 ring-2",
          media ? "w-72 max-w-[78%]" : "px-3.5 py-2",
        )}
      >
        {m.replyTo && (
          <ReplyPreview
            message={m.replyTo}
            mine={mine}
            isMine={m.replyTo.senderId === currentUserId}
          />
        )}
        {media ? (
          <>
            <MessageMedia attachment={media} />
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
                  mediaPreview={mediaPreview}
                />
              </div>
            )}
            {(m.deleted || m.text) && (
              <p className="wrap-break-words whitespace-pre-wrap">
                {m.deleted ? "This message was deleted" : m.text}
              </p>
            )}
          </>
        )}
      </div>

      <Meta message={m} mine={mine} status={status} />

      {!m.deleted && onReaction && (
        <div className="flex flex-wrap items-center gap-1 px-1">
          {[...reactionGroups.entries()].map(([emoji, group]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReaction(emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors",
                group.mine
                  ? "border-brand-500 bg-brand-500/10 text-brand-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              )}
              aria-pressed={group.mine}
            >
              <span>{emoji}</span>
              <span>{group.count}</span>
            </button>
          ))}
          <span className="relative">
            <button
              type="button"
              aria-label="Add a reaction"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((v) => !v)}
              className="flex size-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <Smile className="size-3.5" />
            </button>
            {emojiOpen && (
              <EmojiPopover
                onPick={addReaction}
                onClose={() => setEmojiOpen(false)}
              />
            )}
          </span>
        </div>
      )}
    </div>
  );
}
