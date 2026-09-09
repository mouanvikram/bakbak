import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ChatResponseType, MessageResponseType } from "@bakbak/contracts";
import { MoreVertical, Search, Settings, UserPlus, Users } from "lucide-react";
import { listChats } from "@/features/chat/api";
import { NewGroupModal } from "@/features/chat/components/NewGroupModal";
import { getUnreadCount } from "@/features/messages/api";
import { useSocket } from "@/features/chat/socket-context";
import { useAuth } from "@/features/auth/auth-context";
import { ChatItem } from "@/features/chat/components/ChatItem";
import { EmptyState } from "@/components/ui/States";
import { ChatListSkeleton } from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/IconButton";

export function ChatSidebar() {
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatResponseType[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const knownChatIds = useRef<Set<string>>(new Set());

  // The id of the conversation currently on screen — a message landing there
  // is already being read, so it must not bump the unread badge.
  const openChatId = location.pathname.startsWith("/chats/")
    ? location.pathname.slice("/chats/".length)
    : null;
  const openChatIdRef = useRef(openChatId);
  openChatIdRef.current = openChatId;

  // Chats we've already asked the server about, so a re-fetch doesn't refire.
  const countRequested = useRef<Set<string>>(new Set());

  // Pull unread counts for any chats we don't have a number for yet.
  function seedUnread(list: ChatResponseType[]) {
    for (const chat of list) {
      if (countRequested.current.has(chat.id)) continue;
      countRequested.current.add(chat.id);
      getUnreadCount(chat.id)
        .then(({ count }) =>
          setUnread((cur) => ({
            ...cur,
            [chat.id]: chat.id === openChatIdRef.current ? 0 : count,
          })),
        )
        .catch(() => countRequested.current.delete(chat.id));
    }
  }

  useEffect(() => {
    listChats()
      .then((res) => {
        setChats(res.chats);
        seedUnread(res.chats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    knownChatIds.current = new Set(chats.map((c) => c.id));
  }, [chats]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Opening a chat clears its badge (ChatPage marks it read on the server).
  useEffect(() => {
    if (!openChatId) return;
    setUnread((prev) =>
      prev[openChatId] ? { ...prev, [openChatId]: 0 } : prev,
    );
  }, [openChatId]);

  // Keep the list previews, ordering and unread counts in sync with live events.
  useEffect(() => {
    if (!socket) return;
    const s = socket;

    const onNewMessage = (msg: MessageResponseType) => {
      if (!knownChatIds.current.has(msg.chatId)) {
        // A conversation we don't have yet (someone just messaged us first).
        void listChats()
          .then((res) => {
            setChats(res.chats);
            seedUnread(res.chats);
          })
          .catch(() => {});
        return;
      }

      const fromMe = msg.senderId === currentUserId;
      const isOpen = msg.chatId === openChatIdRef.current;
      if (!fromMe && !isOpen) {
        setUnread((prev) => ({
          ...prev,
          [msg.chatId]: (prev[msg.chatId] ?? 0) + 1,
        }));
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

    // The other side read our messages: reflect it on the chat's ticks.
    const onReadReceipt = (data: {
      chatId: string;
      userId: string;
      messageId: string;
    }) => {
      if (data.userId === currentUserId) return;
      setChats((prev) =>
        prev.map((c) =>
          c.id === data.chatId
            ? {
                ...c,
                participants: c.participants?.map((p) =>
                  p.userId === data.userId
                    ? { ...p, lastReadMessageId: data.messageId }
                    : p,
                ),
              }
            : c,
        ),
      );
    };

    // Group renamed / photo changed / members added or removed.
    const onChatUpdated = (chat: ChatResponseType) => {
      if (!chat?.id) return;
      const stillIn = chat.participants?.some(
        (p) => p.userId === currentUserId,
      );
      setChats((prev) => {
        if (!stillIn) return prev.filter((c) => c.id !== chat.id);
        const idx = prev.findIndex((c) => c.id === chat.id);
        if (idx === -1) return prev;
        // Keep the live message preview/ordering; take metadata from the event.
        const merged: ChatResponseType = {
          ...chat,
          messages: prev[idx].messages,
          lastMessageAt: prev[idx].lastMessageAt,
        };
        return [...prev.slice(0, idx), merged, ...prev.slice(idx + 1)];
      });
    };

    s.on("message:new", onNewMessage);
    s.on("message:edited", onMessageChanged);
    s.on("message:deleted", onMessageChanged);
    s.on("read:receipt", onReadReceipt);
    s.on("chat:updated", onChatUpdated);
    return () => {
      s.off("message:new", onNewMessage);
      s.off("message:edited", onMessageChanged);
      s.off("message:deleted", onMessageChanged);
      s.off("read:receipt", onReadReceipt);
      s.off("chat:updated", onChatUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, currentUserId]);

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chats;
    return chats.filter((chat) => {
      const name = chat.name ?? "";
      const lastMsg = chat.messages?.[0]?.text ?? "";
      return (
        name.toLowerCase().includes(query) ||
        lastMsg.toLowerCase().includes(query)
      );
    });
  }, [search, chats]);

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/images/branding/logo.svg"
            alt="BakBak"
            width={28}
            height={28}
          />
          <span className="text-lg font-bold text-slate-900">BakBak</span>
        </div>

        <div className="relative -mr-1">
          <IconButton
            label="Open menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="size-5" />
          </IconButton>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                {[
                  {
                    icon: UserPlus,
                    label: "New chat",
                    run: () => navigate("/friends"),
                  },
                  {
                    icon: Users,
                    label: "Create group",
                    run: () => setGroupModalOpen(true),
                  },
                  {
                    icon: Settings,
                    label: "Settings",
                    run: () => navigate("/settings"),
                  },
                ].map(({ icon: Icon, label, run }) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      run();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Icon className="size-4 text-slate-400" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative mb-1 px-2">
        <Search className="absolute top-1/2 left-5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chats"
          className="focus-visible:ring-brand-500/30 h-9 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus-visible:ring-2"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {loading ? (
          <ChatListSkeleton />
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              unreadCount={unread[chat.id] ?? 0}
              onDeleted={(chatId) => {
                setChats((prev) => prev.filter((c) => c.id !== chatId));
                setUnread((prev) => {
                  const next = { ...prev };
                  delete next[chatId];
                  return next;
                });
                countRequested.current.delete(chatId);
                if (openChatId === chatId) navigate("/chats");
              }}
            />
          ))
        ) : (
          <EmptyState
            text={
              search.trim()
                ? "No chats match your search."
                : "No conversations yet. Start one from Friends."
            }
          />
        )}
      </div>

      {groupModalOpen && (
        <NewGroupModal onClose={() => setGroupModalOpen(false)} />
      )}
    </aside>
  );
}
