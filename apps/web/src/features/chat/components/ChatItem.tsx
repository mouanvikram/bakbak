import { NavLink } from "react-router";
import type { ChatResponseType } from "@bakbak/contracts";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/auth-context";
import { usePresence } from "@/features/chat/presence-context";

export function ChatItem({
  chat,
  unreadCount = 0,
}: {
  chat: ChatResponseType;
  unreadCount?: number;
}) {
  const { user } = useAuth();
  const { isOnline } = usePresence();
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
  const online =
    chat.type === "DIRECT" && isOnline(otherParticipant?.user?.id);
  const mineLast = lastMessage?.senderId === currentUserId;
  const hasUnread = unreadCount > 0;
  // "Seen" once the other side's read pointer reaches our latest message.
  const seenByOther =
    mineLast &&
    chat.type === "DIRECT" &&
    !!lastMessage &&
    otherParticipant?.lastReadMessageId === lastMessage.id;

  return (
    <NavLink
      to={`/chats/${chat.id}`}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
          isActive ? "bg-violet-50" : "hover:bg-slate-50",
        )
      }
    >
      <Avatar name={displayName} src={avatarSrc} online={online} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm text-slate-800",
              hasUnread ? "font-semibold" : "font-medium",
            )}
          >
            {displayName}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px]",
              hasUnread ? "font-semibold text-violet-600" : "text-slate-400",
            )}
          >
            {lastMessage?.createdAt
              ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : ""}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {lastMessage && mineLast && (
              seenByOther ? (
                <CheckCheck className="size-3.5 shrink-0 text-sky-500" />
              ) : (
                <Check className="size-3.5 shrink-0 text-slate-400" />
              )
            )}
            <span
              className={cn(
                "truncate text-xs",
                hasUnread ? "text-slate-700 dark:text-slate-200" : "text-slate-500",
              )}
            >
              {lastMessage?.text ?? ""}
            </span>
          </div>

          {hasUnread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </NavLink>
  );
}
