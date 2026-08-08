import { useMemo, useState } from "react";
import {
  LogOut,
  MessageSquarePlus,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import type { Chat } from "../types/api";
import {
  formatMessageTime,
  getDisplayName,
  cn,
} from "../lib/utils";
import {
  getChatAvatar,
  getChatTitle,
  getLastMessagePreview,
} from "../lib/chat";
import { Avatar, Button, Input, Spinner } from "./ui";
import type { MeProfile } from "../types/api";

type Tab = "chats" | "friends" | "settings";

export function ChatSidebar({
  chats,
  isLoading,
  currentUserId,
  user,
  selectedChatId,
  activeTab,
  onSelectChat,
  onTabChange,
  onLogout,
  onNewChat,
  theme,
  onToggleTheme,
}: {
  chats: Chat[];
  isLoading: boolean;
  currentUserId?: string | null;
  user?: MeProfile | null;
  selectedChatId?: string | null;
  activeTab: Tab;
  onSelectChat: (chatId: string) => void;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  onNewChat: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => {
      const title = getChatTitle(chat, currentUserId).toLowerCase();
      const preview = getLastMessagePreview(chat).toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [chats, query, currentUserId]);

  const displayName = getDisplayName(user);

  return (
    <aside className="flex h-full w-full max-w-full flex-col border-r border-border bg-surface-2 md:w-[360px] md:max-w-[360px] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName} src={user?.avatar} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {displayName}
            </p>
            <p className="truncate text-xs text-ink-muted">
              @{user?.username ?? "…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            title="New chat"
            onClick={onNewChat}
            type="button"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Toggle theme"
            onClick={onToggleTheme}
            type="button"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Log out"
            onClick={onLogout}
            type="button"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface px-2 pt-1">
        {(
          [
            { id: "chats", label: "Chats", icon: Search },
            { id: "friends", label: "Friends", icon: Users },
            { id: "settings", label: "Settings", icon: Settings },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-sm font-medium transition",
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "chats" && (
        <>
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="bg-surface-3 pl-9"
              />
            </div>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex justify-center py-10">
                <Spinner className="text-accent" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-ink-muted">
                {query
                  ? "No chats match your search."
                  : "No chats yet. Start one from Friends."}
              </div>
            )}

            {filtered.map((chat) => {
              const title = getChatTitle(chat, currentUserId);
              const avatar = getChatAvatar(chat, currentUserId);
              const preview = getLastMessagePreview(chat);
              const selected = selectedChatId === chat.id;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-surface-3",
                    selected && "bg-surface-3",
                  )}
                >
                  <Avatar name={title} src={avatar} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">
                        {title}
                      </p>
                      <span className="shrink-0 text-[11px] text-ink-muted">
                        {formatMessageTime(
                          chat.lastMessageAt ?? chat.messages?.[0]?.createdAt,
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Friends & Settings content rendered by parent in main panel on mobile-friendly tabs —
          keep sidebar list area empty for non-chat tabs so parent shows panel content */}
      {activeTab !== "chats" && (
        <div className="flex-1 overflow-hidden md:hidden">
          {/* Mobile: parent will show full-width panels; this is a placeholder */}
        </div>
      )}
    </aside>
  );
}
