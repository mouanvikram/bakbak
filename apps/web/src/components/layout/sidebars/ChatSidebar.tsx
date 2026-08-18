import { CheckCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

type Chat = {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline?: boolean;
  isRead?: boolean;
};

const chats: Chat[] = [
  {
    id: "1",
    user: {
      id: "user-1",
      name: "Rahul",
    },
    lastMessage: "Hey, are you coming?",
    timestamp: "10:42 AM",
    unreadCount: 0,
    isOnline: true,
    isRead: true,
  },
  {
    id: "2",
    user: {
      id: "user-2",
      name: "Priya",
    },
    lastMessage: "📷 Photo",
    timestamp: "9:21 AM",
    unreadCount: 2,
    isOnline: true,
  },
  {
    id: "3",
    user: {
      id: "user-3",
      name: "John",
    },
    lastMessage: "See you tomorrow",
    timestamp: "Yesterday",
    unreadCount: 0,
    isRead: true,
  },
  {
    id: "4",
    user: {
      id: "user-4",
      name: "Alex",
    },
    lastMessage: "👍",
    timestamp: "Monday",
    unreadCount: 3,
  },
];

export function ChatSidebar() {
  const [search, setSearch] = useState("");

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return chats;
    }

    return chats.filter(
      (chat) =>
        chat.user.name.toLowerCase().includes(query) ||
        chat.lastMessage.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <aside className="flex h-full w-full flex-col rounded-lg bg-white p-3 shadow-md">
      {/* Header */}
      <div className="mb-3 px-2">
        <h2 className="text-xl font-semibold">Chats</h2>
      </div>

      {/* Search */}
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

      {/* Chat list */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {filteredChats.length > 0 ? (
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

type ChatItemProps = {
  chat: Chat;
};

function ChatItem({ chat }: ChatItemProps) {
  const hasUnread = chat.unreadCount > 0;

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
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-600">
          {chat.user.name.charAt(0).toUpperCase()}
        </div>

        {chat.isOnline && (
          <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-green-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              hasUnread
                ? "font-semibold text-slate-900"
                : "font-medium text-slate-800",
            )}
          >
            {chat.user.name}
          </span>

          <span
            className={cn(
              "shrink-0 text-[11px]",
              hasUnread ? "font-medium text-violet-600" : "text-slate-400",
            )}
          >
            {chat.timestamp}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {chat.isRead && (
              <CheckCheck className="size-3.5 shrink-0 text-violet-500" />
            )}

            <span
              className={cn(
                "truncate text-xs",
                hasUnread ? "font-medium text-slate-700" : "text-slate-500",
              )}
            >
              {chat.lastMessage}
            </span>
          </div>

          {hasUnread && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">
              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </NavLink>
  );
}
