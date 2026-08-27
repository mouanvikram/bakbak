import { CheckCheck, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { listChats } from "@/api/chat.api";
import type { ChatResponseType } from "@bakbak/contracts";

export function ChatSidebar() {
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatResponseType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listChats()
      .then((res) => setChats(res.chats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chats;
    return chats.filter((chat) => {
      const name = chat.name ?? "";
      const lastMsg = chat.messages?.[0]?.text ?? "";
      return name.toLowerCase().includes(query) || lastMsg.toLowerCase().includes(query);
    });
  }, [search, chats]);

  return (
    <aside className="flex h-full w-full flex-col rounded-lg bg-white p-3 shadow-md">
      <div className="mb-3 px-2">
        <h2 className="text-xl font-semibold">Chats</h2>
      </div>

      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats..."
          className="h-9 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => <ChatItem key={chat.id} chat={chat} />)
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
            No chats found
          </div>
        )}
      </div>
    </aside>
  );
}

function ChatItem({ chat }: { chat: ChatResponseType }) {
  const lastMessage = chat.messages?.[0];
  const displayName = chat.type === "DIRECT"
    ? chat.participants?.[0]?.user?.profile?.displayName ?? chat.participants?.[0]?.user?.username ?? "Unknown"
    : chat.name ?? "Group";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <NavLink
      to={`/chats/${chat.id}`}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
          isActive ? "bg-violet-50" : "hover:bg-slate-50",
        )
      }
    >
      <div className="relative shrink-0">
        <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-600">
          {initials}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-800">
            {displayName}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400">
            {lastMessage?.createdAt
              ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : ""}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {lastMessage && (
              <CheckCheck className="size-3.5 shrink-0 text-violet-500" />
            )}
            <span className="truncate text-xs text-slate-500">
              {lastMessage?.text ?? ""}
            </span>
          </div>
        </div>
      </div>
    </NavLink>
  );
}
