import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { ChatResponseType, MessageResponseType } from "@bakbak/contracts";
import { MoreVertical, Search, Settings, UserPlus } from "lucide-react";
import { listChats } from "@/features/chat/api";
import { useSocket } from "@/features/chat/socket-context";
import { ChatItem } from "@/features/chat/components/ChatItem";
import { EmptyState, LoadingState } from "@/components/ui/States";

export function ChatSidebar() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const knownChatIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    listChats()
      .then((res) => setChats(res.chats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    knownChatIds.current = new Set(chats.map((c) => c.id));
  }, [chats]);

  // Keep the list previews and ordering in sync with live message events.
  useEffect(() => {
    if (!socket) return;
    const s = socket;

    const onNewMessage = (msg: MessageResponseType) => {
      if (!knownChatIds.current.has(msg.chatId)) {
        // A conversation we don't have yet (someone just messaged us first).
        void listChats()
          .then((res) => setChats(res.chats))
          .catch(() => {});
        return;
      }
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.chatId);
        if (idx === -1) return prev;
        const updated: ChatResponseType = {
          ...prev[idx],
          messages: [msg],
          lastMessageAt: msg.createdAt,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    };

    // Edit/delete only matter here when they hit the chat's latest message.
    const onMessageChanged = (msg: MessageResponseType) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === msg.chatId && c.messages?.[0]?.id === msg.id
            ? { ...c, messages: [msg] }
            : c,
        ),
      );
    };

    s.on("message:new", onNewMessage);
    s.on("message:edited", onMessageChanged);
    s.on("message:deleted", onMessageChanged);
    return () => {
      s.off("message:new", onNewMessage);
      s.off("message:edited", onMessageChanged);
      s.off("message:deleted", onMessageChanged);
    };
  }, [socket]);

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
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/images/branding/logo.svg"
            alt="BakBak"
            width={28}
            height={28}
          />
          <span className="text-lg font-bold text-slate-900">BakBak</span>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex cursor-pointer items-center justify-center rounded-full p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <MoreVertical className="size-5" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/friends");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <UserPlus className="size-4" />
                  New chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings className="size-4" />
                  Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative mb-2 px-3">
        <Search className="absolute top-1/2 left-6 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats..."
          className="h-9 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
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
