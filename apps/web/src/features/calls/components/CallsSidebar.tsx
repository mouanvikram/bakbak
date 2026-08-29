import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Phone, Search, Video } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/States";
import { calls, type Call } from "@/features/calls/data/calls";

export function CallsSidebar() {
  const [search, setSearch] = useState("");

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return calls;
    return calls.filter((call) => call.user.name.toLowerCase().includes(query));
  }, [search]);

  return (
    <aside className="flex h-full w-full flex-col rounded-lg bg-white p-3 shadow-md">
      <div className="mb-3 px-2">
        <h2 className="text-xl font-semibold">Calls</h2>
      </div>

      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search calls..."
          className="h-9 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {filteredCalls.length > 0 ? (
          filteredCalls.map((call) => <CallItem key={call.id} call={call} />)
        ) : (
          <EmptyState text="No calls found" />
        )}
      </div>
    </aside>
  );
}

function CallItem({ call }: { call: Call }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
    >
      <div className="flex size-10 shrink-0">
        <Avatar name={call.user.name} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-900">
          {call.user.name}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <CallStatus call={call} />
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{call.timestamp}</span>
        </div>
      </div>

      {call.mode === "video" ? (
        <Video className="size-4 shrink-0 text-slate-400" />
      ) : (
        <Phone className="size-4 shrink-0 text-slate-400" />
      )}
    </button>
  );
}

function CallStatus({ call }: { call: Call }) {
  if (call.type === "missed") {
    return (
      <span className="flex items-center gap-1 text-red-500">
        <ArrowDownLeft className="size-3.5" />
        Missed
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-slate-500">
      {call.type === "incoming" ? (
        <ArrowDownLeft className="size-3.5" />
      ) : (
        <ArrowUpRight className="size-3.5" />
      )}
      {call.type === "incoming" ? "Incoming" : "Outgoing"}
    </span>
  );
}