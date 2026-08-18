import {
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  Search,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type CallType = "incoming" | "outgoing" | "missed";
type CallMode = "voice" | "video";

type Call = {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  type: CallType;
  mode: CallMode;
  timestamp: string;
  duration?: string;
};

const calls: Call[] = [
  {
    id: "1",
    user: {
      id: "user-1",
      name: "Rahul",
    },
    type: "outgoing",
    mode: "voice",
    timestamp: "10:42 AM",
    duration: "12 min",
  },
  {
    id: "2",
    user: {
      id: "user-2",
      name: "Priya",
    },
    type: "missed",
    mode: "video",
    timestamp: "Yesterday",
  },
  {
    id: "3",
    user: {
      id: "user-3",
      name: "John",
    },
    type: "outgoing",
    mode: "voice",
    timestamp: "Yesterday",
    duration: "5 min",
  },
  {
    id: "4",
    user: {
      id: "user-4",
      name: "Alex",
    },
    type: "incoming",
    mode: "voice",
    timestamp: "Monday",
    duration: "8 min",
  },
];

export function CallsSidebar() {
  const [search, setSearch] = useState("");

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return calls;
    }

    return calls.filter((call) => call.user.name.toLowerCase().includes(query));
  }, [search]);

  return (
    <aside className="flex h-full w-full flex-col rounded-lg bg-white p-3 shadow-md">
      {/* Header */}
      <div className="mb-3 px-2">
        <h2 className="text-xl font-semibold">Calls</h2>
      </div>

      {/* Search */}
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

      {/* Call history */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {filteredCalls.length > 0 ? (
          filteredCalls.map((call) => <CallItem key={call.id} call={call} />)
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
            No calls found
          </div>
        )}
      </div>
    </aside>
  );
}

function CallItem({ call }: { call: Call }) {
  const isMissed = call.type === "missed";

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
    >
      {/* Avatar */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-600">
        {call.user.name.charAt(0).toUpperCase()}
      </div>

      {/* Information */}
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

      {/* Call type */}
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

  if (call.type === "incoming") {
    return (
      <span className="flex items-center gap-1 text-slate-500">
        <ArrowDownLeft className="size-3.5" />
        Incoming
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-slate-500">
      <ArrowUpRight className="size-3.5" />
      Outgoing
    </span>
  );
}
