import { useLocation } from "react-router";
import { ChatSidebar } from "@/features/chat/components/ChatSidebar";
import { SettingsSidebar } from "@/features/settings/components/SettingsSidebar";
import { CallsSidebar } from "@/features/calls/components/CallsSidebar";
import { FriendsSidebar } from "@/features/friends/components/FriendsSidebar";

export function SectionSidebar() {
  const location = useLocation();

  if (location.pathname.startsWith("/chats")) {
    return <ChatSidebar />;
  }

  if (location.pathname.startsWith("/friends")) {
    return <FriendsSidebar />;
  }

  if (location.pathname.startsWith("/calls")) {
    return <CallsSidebar />;
  }

  if (location.pathname.startsWith("/settings")) {
    return <SettingsSidebar />;
  }

  return null;
}