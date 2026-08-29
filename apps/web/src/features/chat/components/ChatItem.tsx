import { NavLink } from "react-router";
import type { ChatResponseType } from "@bakbak/contracts";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

export function ChatItem({ chat }: { chat: ChatResponseType }) {
  const lastMessage = chat.messages?.[0];
  const displayName = chat.type === "DIRECT"
    ? chat.participants?.[0]?.user?.profile?.displayName ?? chat.participants?.[0]?.user?.username ?? "Unknown"
    : chat.name ?? "Group";

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
        <Avatar name={displayName} />
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