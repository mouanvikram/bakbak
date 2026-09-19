import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
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

/** "Sep 12, 14:30" — enough to place a call without the noise of a full date. */
function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${formatDay(iso)}, ${formatTime(iso)}`;
}

/**
 * One call, in full.
 *
 * Read from the same history endpoint the list uses rather than a dedicated
 * per-call route: the history is capped at 100 rows and already authorised to
 * the viewer, so a second endpoint would add a second place to get that check
 * wrong for no benefit.
 */
export function CallDetail() {
  const { callId } = useParams<{ callId: string }>();
  const [call, setCall] = useState<CallRecordType | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listCallHistory()
      .then((res) => {
        if (cancelled) return;
        const found = res.calls.find((c) => c.id === callId) ?? null;
        setCall(found);
        setState(found ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  if (state === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (state === "error") return <EmptyState text="Couldn't load this call" />;
  if (state === "missing" || !call) {
    return <EmptyState text="That call is no longer in your history" />;
  }

  const outgoing = call.direction === "OUTGOING";
  const unanswered = call.status === "MISSED" || call.status === "DECLINED";
  const name = call.peer.displayName ?? call.peer.username;
  const Icon = unanswered ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;

  const outcome =
    call.status === "ANSWERED"
      ? outgoing
        ? "Outgoing call"
        : "Incoming call"
      : call.status === "DECLINED"
        ? outgoing
          ? "Declined by them"
          : "You declined"
        : call.status === "FAILED"
          ? "Call failed"
          : outgoing
            ? "No answer"
            : "Missed call";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center gap-2 px-4 py-3 md:hidden">
        <Link
          to="/calls"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Back to calls"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-8">
        <Avatar name={name} src={call.peer.avatar} className="size-20" />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">{name}</h1>
          <p className="text-sm text-slate-500">@{call.peer.username}</p>
        </div>

        <div
          className={cn(
            "mt-1 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
            unanswered ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700",
          )}
        >
          <Icon className={cn("size-4", unanswered && "text-red-500")} aria-hidden />
          <span>{outcome}</span>
        </div>
      </div>

      <dl className="mx-4 mb-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
        <Row
          label="Type"
          value={
            <span className="flex items-center gap-1.5">
              {call.type === "VIDEO" ? (
                <Video className="size-4 text-slate-400" />
              ) : (
                <Phone className="size-4 text-slate-400" />
              )}
              {call.type === "VIDEO" ? "Video" : "Voice"}
            </span>
          }
        />
        <Row label="Started" value={when(call.startedAt)} />
        {call.answeredAt ? (
          <Row label="Answered" value={when(call.answeredAt)} />
        ) : null}
        {call.endedAt ? (
          <Row label="Ended" value={when(call.endedAt)} />
        ) : null}
        {/* Only a connected call has a duration — a missed one sat ringing but
            lasted no time at all, so showing "0:00" would be a small lie. */}
        {call.status === "ANSWERED" ? (
          <Row
            label="Duration"
            value={formatDuration(call.durationSeconds) || "—"}
          />
        ) : null}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
