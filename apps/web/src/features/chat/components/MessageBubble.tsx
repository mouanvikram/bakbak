import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Check, CheckCheck, Reply, Smile } from "lucide-react";
import type { MessageResponseType } from "@bakbak/contracts";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import {
  MessageAttachments,
  MessageMedia,
} from "@/features/chat/components/MessageAttachments";

export type DeliveryStatus = "sent" | "delivered" | "seen";

// Image and video attachments get the edge-to-edge media treatment.
const PREVIEWABLE = new Set(["IMAGE", "VIDEO"]);

// Shortlist shown in the compact reaction picker.
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

const REACTION_PICKER_WIDTH = 8 * 36 + 12;
const REACTION_PICKER_HEIGHT = 44;

interface PickerAnchor {
  x: number;
  y: number;
  height: number;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Edited once updatedAt is meaningfully after createdAt.
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

// Text shown for the answered message inside a reply quote.
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

// The compact "answering this" strip pinned to the top of a bubble.
function ReplyPreview({
  message: m,
  mine,
  isMine,
  onJump,
}: {
  message: MessageResponseType;
  mine: boolean;
  isMine: boolean;
  // Scrolls the thread to the answered message.
  onJump?: () => void;
}) {
  const name = isMine
    ? "You"
    : m.sender.profile?.displayName ?? m.sender.username ?? "Unknown";
  // Inset 4px from the bubble edge, so its top corners follow the bubble's
  // 16px curve (16 - 4 = 12) and the accent bar is clipped by that curve.
  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!onJump}
      aria-label={`Go to ${name}'s message`}
      className={cn(
        "relative block w-full overflow-hidden rounded-t-xl rounded-b-lg py-1.5 pr-3 pl-3.5 text-left transition-opacity enabled:hover:opacity-85 enabled:active:opacity-70",
        mine ? "bg-white/15" : "bg-slate-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          mine ? "bg-white/80" : "bg-brand-500",
        )}
      />
      <div
        className={cn(
          "flex items-center gap-1 text-xs font-semibold",
          mine ? "text-white" : "text-brand-600",
        )}
      >
        <Reply className="size-3 shrink-0" />
        <span className="truncate">{name}</span>
      </div>
      <p
        className={cn(
          "truncate text-xs",
          mine ? "text-white/75" : "text-slate-500",
          m.deleted && "italic",
        )}
      >
        {replySummary(m)}
      </p>
    </button>
  );
}

// One message row: sender header (groups), bubble, meta, and reactions.
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
  animateIn = false,
  highlighted = false,
  onJumpToReply,
}: {
  message: MessageResponseType;
  mine: boolean;
  isGroup: boolean;
  isEditing: boolean;
  status: DeliveryStatus;
  // Plays the arrival animation (messages that land while the chat is open).
  animateIn?: boolean;
  // Briefly outlined after the thread jumps to this message.
  highlighted?: boolean;
  // Clicking the reply quote scrolls to the message it answers.
  onJumpToReply?: () => void;
  // When false, images/videos render as download chips instead of inline.
  mediaPreview?: boolean;
  onContextMenu: (e: MouseEvent) => void;
  currentUserId: string;
  // Toggles an emoji on this message (add, or remove if already used).
  onReaction?: (emoji: string) => void;
}) {
  const senderName = m.sender.profile?.displayName ?? m.sender.username ?? "";
  const [picker, setPicker] = useState<PickerAnchor | null>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);

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
    setPicker(null);
    onReaction?.(emoji);
  };

  const openPicker = () => {
    const el = pickerButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPicker({ x: rect.left, y: rect.top, height: rect.height });
  };

  return (
    <div
      data-message-id={m.id}
      className={cn(
        "flex flex-col",
        mine ? "origin-bottom-right items-end" : "origin-bottom-left items-start",
        animateIn &&
          "motion-safe:animate-[msg-in_240ms_var(--ease-emphasized)]",
      )}
    >
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
          // Outline, not ring: the dark incoming bubble owns box-shadow.
          "outline-2 outline-offset-2 transition-[outline-color] duration-500",
          highlighted ? "outline-brand-500" : "outline-transparent",
          mine
            ? "msg-bubble-out rounded-br-md text-white"
            : "msg-bubble-in rounded-bl-md text-gray-900",
          isEditing && "ring-brand-500/60 ring-2",
          media && "w-72 max-w-[78%]",
          m.replyTo && "min-w-48",
        )}
      >
        {m.replyTo && (
          <div className="p-1">
            <ReplyPreview
              message={m.replyTo}
              mine={mine}
              isMine={m.replyTo.senderId === currentUserId}
              onJump={onJumpToReply}
            />
          </div>
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
          <div className={cn("px-3.5 pb-2", m.replyTo ? "pt-1" : "pt-2")}>
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
          </div>
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
                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition active:scale-90",
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
          <button
            ref={pickerButtonRef}
            type="button"
            aria-label="Add a reaction"
            aria-expanded={picker !== null}
            onClick={openPicker}
            className="flex size-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <Smile className="size-3.5" />
          </button>
          {picker &&
            createPortal(
              <ReactionPicker
                anchor={picker}
                onPick={addReaction}
                onClose={() => setPicker(null)}
              />,
              document.body,
            )}
        </div>
      )}
    </div>
  );
}

// Compact portal-based reaction picker, clamped to the viewport.
function ReactionPicker({
  anchor,
  onPick,
  onClose,
}: {
  anchor: PickerAnchor;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onOutside = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    const settle = setTimeout(
      () => window.addEventListener("mousedown", onOutside),
      0,
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onOutside);
      clearTimeout(settle);
    };
  }, [onClose]);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const above = anchor.y > REACTION_PICKER_HEIGHT + 8;
  const left = Math.min(
    Math.max(anchor.x, 8),
    Math.max(8, viewportWidth - REACTION_PICKER_WIDTH),
  );
  const top = above
    ? undefined
    : Math.min(
        anchor.y + anchor.height + 6,
        viewportHeight - REACTION_PICKER_HEIGHT - 8,
      );

  return (
    <div
      ref={ref}
      className={cn(
        "fixed z-50 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl motion-safe:animate-[pop-in_140ms_var(--ease-emphasized)]",
        above ? "origin-bottom-left" : "origin-top-left",
      )}
      style={{
        width: REACTION_PICKER_WIDTH,
        left,
        top,
        bottom: above ? viewportHeight - anchor.y + 6 : undefined,
      }}
    >
      <div className="flex items-center gap-0.5">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className="flex size-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-gray-100 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
