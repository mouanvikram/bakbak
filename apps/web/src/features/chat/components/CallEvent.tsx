import { Phone, PhoneMissed, Video } from "lucide-react";
import type { MessageCallType } from "@bakbak/contracts";
import { formatDuration, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * A finished call, rendered inline in the conversation.
 *
 * Centred rather than sided, because a call isn't something one person said —
 * both took part, and "missed" reads as an event that happened to the pair.
 * Direction is derived per viewer from `callerId`, so the same row shows as
 * outgoing to the caller and incoming to the callee.
 */
export function CallEvent({
  call,
  currentUserId,
  createdAt,
  animateIn,
}: {
  call: MessageCallType;
  currentUserId: string;
  createdAt: string;
  animateIn?: boolean;
}) {
  const outgoing = call.callerId === currentUserId;
  const video = call.type === "VIDEO";

  // A row still marked RINGING never closed cleanly (a crash, a lost socket).
  // To whoever is reading the conversation, that was a missed call.
  const status = call.status === "RINGING" ? "MISSED" : call.status;
  const unanswered = status === "MISSED" || status === "DECLINED";

  const label = (() => {
    const kind = video ? "Video call" : "Voice call";
    switch (status) {
      case "ANSWERED":
        return formatDuration(call.durationSeconds)
          ? `${kind} · ${formatDuration(call.durationSeconds)}`
          : kind;
      case "DECLINED":
        return outgoing ? `${kind} declined` : `You declined a ${kind.toLowerCase()}`;
      case "FAILED":
        return `${kind} failed`;
      default:
        return outgoing ? `${kind}, no answer` : `Missed ${kind.toLowerCase()}`;
    }
  })();

  const Icon = unanswered ? PhoneMissed : video ? Video : Phone;

  return (
    <div
      className={cn(
        "flex justify-center py-1",
        animateIn && "motion-safe:animate-[fadeIn_180ms_ease-out]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs",
          unanswered
            ? "bg-red-50 text-red-700"
            : "bg-slate-100 text-slate-600",
        )}
      >
        <Icon
          className={cn("size-3.5 shrink-0", unanswered && "text-red-500")}
          aria-hidden
        />
        <span>{label}</span>
        <span className={unanswered ? "text-red-400" : "text-slate-400"}>
          {formatTime(createdAt)}
        </span>
      </div>
    </div>
  );
}
