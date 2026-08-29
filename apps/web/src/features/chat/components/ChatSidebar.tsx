import { useEffect, useMemo, useState } from "react";
import type { ChatResponseType } from "@bakbak/contracts";
import { Search } from "lucide-react";
import { listChats } from "@/features/chat/api";
import { ChatItem } from "@/features/chat/components/ChatItem";
import { EmptyState, LoadingState } from "@/components/ui/States";

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
          <LoadingState />
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => <ChatItem key={chat.id} chat={chat} />)
        ) : (
          <EmptyState text="No chats found" />
        )}
      </div>
    </aside>
  );
}