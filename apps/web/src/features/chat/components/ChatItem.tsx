import { useState } from "react";
import { NavLink } from "react-router";
import type { ChatResponseType } from "@bakbak/contracts";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { leaveChat } from "@/features/chat/api";
import { useAuth } from "@/features/auth/auth-context";
import { usePresence } from "@/features/chat/presence-context";

export function ChatItem({
  chat,
  unreadCount = 0,
  onDeleted,
}: {
  chat: ChatResponseType;
  unreadCount?: number;
  /** Called after the chat is removed from the caller's list ("delete for me"). */
  onDeleted?: (chatId: string) => void;
}) {
  const { user } = useAuth();
  const { isOnline } = usePresence();
  const { error: toastError } = useToast();
  const currentUserId = user?.id;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await leaveChat(chat.id);
      onDeleted?.(chat.id);
    } catch {
      toastError("Couldn't delete the chat");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }
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
      : chat.avatar ?? undefined;
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

  const preview =
    lastMessage?.text?.trim() ||
    (lastMessage
      ? lastMessage.type === "IMAGE"
        ? "Photo"
        : lastMessage.type === "VIDEO"
          ? "Video"
          : lastMessage.type === "AUDIO"
            ? "Voice message"
            : lastMessage.type === "TEXT"
              ? ""
              : "Attachment"
      : "");

  return (
    <>
    <NavLink
      to={`/chats/${chat.id}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
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
              {preview}
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

    {menu && (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
        items={[
          {
            label: "Delete chat",
            icon: <Trash2 />,
            destructive: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
    )}

    {confirmOpen && (
      <ConfirmDialog
        title="Delete chat"
        message={`This removes "${displayName}" from your chat list. The other ${
          chat.type === "GROUP" ? "members" : "person"
        } will still have it.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    )}
    </>
  );
}
