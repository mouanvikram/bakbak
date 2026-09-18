import { useEffect, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
} from "lucide-react";
import type { CallRecordType } from "@bakbak/contracts";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/States";
import { Spinner } from "@/components/ui/Spinner";
import { listCallHistory } from "@/features/calls/api";
import { formatDay, formatDuration, formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Today shows a clock time; anything older shows its date. */
function whenLabel(iso: string): string {
  const started = new Date(iso);
  const today = new Date();
  const sameDay =
    started.getFullYear() === today.getFullYear() &&
    started.getMonth() === today.getMonth() &&
    started.getDate() === today.getDate();
  return sameDay ? formatTime(iso) : formatDay(iso);
}

function CallRow({ call }: { call: CallRecordType }) {
  const missed = call.status === "MISSED" || call.status === "DECLINED";
  const outgoing = call.direction === "OUTGOING";

  const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;

  // What actually happened, in the fewest words that stay honest: a declined
  // call is not the same as an unanswered one, and neither has a duration.
  const detail =
    call.status === "ANSWERED"
      ? (formatDuration(call.durationSeconds) || "Answered")
      : call.status === "DECLINED"
        ? outgoing
          ? "Declined"
          : "You declined"
        : call.status === "FAILED"
          ? "Failed"
          : outgoing
            ? "No answer"
            : "Missed";

  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50">
      <Avatar name={call.peer.displayName ?? call.peer.username} src={call.peer.avatar} />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            missed ? "text-red-600" : "text-slate-800",
          )}
        >
          {call.peer.displayName ?? call.peer.username}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon className={cn("size-3.5 shrink-0", missed && "text-red-500")} />
          <span className="truncate">{detail}</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] text-slate-400">
          {whenLabel(call.startedAt)}
        </span>
        {call.type === "VIDEO" ? (
          <Video className="size-3.5 text-slate-400" />
        ) : (
          <Phone className="size-3.5 text-slate-400" />
        )}
      </div>
    </li>
  );
}

export function CallsSidebar() {
  const [calls, setCalls] = useState<CallRecordType[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listCallHistory()
      .then((res) => {
        if (!cancelled) setCalls(res.calls);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your calls");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="px-5 py-3">
        <h2 className="text-lg font-bold text-slate-900">Calls</h2>
      </div>

      {calls === null && !error ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : error ? (
        <EmptyState text={error} />
      ) : calls && calls.length === 0 ? (
        <EmptyState text="No calls yet. Start one from any chat." />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {calls?.map((call) => <CallRow key={call.id} call={call} />)}
        </ul>
      )}
    </aside>
  );
}
