import { useLocation } from "react-router";
import { ChatSidebar } from "./sidebars/ChatSidebar";
import { SettingsSidebar } from "./sidebars/SettingsSidebar";
import { CallsSidebar } from "./sidebars/CallsSidebar";
import { FriendsSidebar } from "./sidebars/FriendsSidebar";

export function SecondSidebar() {
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
