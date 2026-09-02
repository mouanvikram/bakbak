import { NavLink } from "react-router";
import type { ChatResponseType } from "@bakbak/contracts";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/auth-context";

export function ChatItem({ chat }: { chat: ChatResponseType }) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const lastMessage = chat.messages?.[0];
  // For direct chats, show the *other* participant — participants isn't ordered,
  // so participants[0] can be the current user.
  const otherParticipant = chat.participants?.find(
    (p) => p.user?.id !== currentUserId,
  );
  const displayName = chat.type === "DIRECT"
    ? otherParticipant?.user?.profile?.displayName ?? otherParticipant?.user?.username ?? "Unknown"
    : chat.name ?? "Group";
  const avatarSrc =
    chat.type === "DIRECT"
      ? otherParticipant?.user?.profile?.avatar ?? undefined
      : undefined;

  return (
    <NavLink
      to={`/chats/${chat.id}`}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 transition-colors",
          isActive ? "bg-violet-50" : "hover:bg-slate-50",
        )
      }
    >
      <div className="relative shrink-0">
        <Avatar name={displayName} src={avatarSrc} />
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