import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listChats } from "../lib/api";
import { useAuthStore } from "../stores/auth-store";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useTheme } from "../hooks/useTheme";
import { ChatSidebar } from "../components/ChatSidebar";
import { MessagePane } from "../components/MessagePane";
import { FriendsPanel } from "../components/FriendsPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { cn } from "../lib/utils";

type Tab = "chats" | "friends" | "settings";

export function ChatApp() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const userId = useAuthStore((s) => s.userId);
  const { user } = useCurrentUser();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>("chats");

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: () => listChats({ limit: 50 }),
    refetchInterval: 5000,
  });

  const chats = chatsQuery.data ?? [];
  const selectedChat = useMemo(
    () => chats.find((c) => c.id === chatId) ?? null,
    [chats, chatId],
  );

  // If we have a chatId but it's not in the list yet, still try to show messages
  const activeChat = selectedChat;

  const handleSelectChat = (id: string) => {
    setTab("chats");
    navigate(`/chats/${id}`);
  };

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const handleNewChat = () => {
    setTab("friends");
    navigate("/");
  };

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (next !== "chats") {
      navigate("/");
    }
  };

  const showChatOnMobile = Boolean(chatId) && tab === "chats";

  return (
    <div className="flex h-full min-h-0 bg-surface-2">
      <div
        className={cn(
          "h-full min-h-0 w-full md:w-auto",
          showChatOnMobile ? "hidden md:flex" : "flex",
        )}
      >
        <ChatSidebar
          chats={chats}
          isLoading={chatsQuery.isLoading}
          currentUserId={userId}
          user={user}
          selectedChatId={chatId}
          activeTab={tab}
          onSelectChat={handleSelectChat}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onNewChat={handleNewChat}
          theme={theme}
          onToggleTheme={toggle}
        />
      </div>

      <main
        className={cn(
          "min-h-0 min-w-0 flex-1",
          // On mobile, hide main when on chats tab with no selection
          tab === "chats" && !chatId ? "hidden md:flex md:flex-col" : "flex flex-col",
          // When friends/settings on mobile, show full width
          tab !== "chats" && "flex",
        )}
      >
        {tab === "friends" && (
          <FriendsPanel
            currentUserId={userId}
            onOpenChat={handleSelectChat}
          />
        )}
        {tab === "settings" && <SettingsPanel user={user} />}
        {tab === "chats" && (
          <MessagePane
            chat={
              activeChat ??
              (chatId
                ? ({
                    id: chatId,
                    type: "DIRECT",
                    participants: [],
                    messages: [],
                    createdAt: "",
                    updatedAt: "",
                  } as never)
                : null)
            }
            currentUserId={userId}
            onBack={() => navigate("/")}
          />
        )}
      </main>
    </div>
  );
}
