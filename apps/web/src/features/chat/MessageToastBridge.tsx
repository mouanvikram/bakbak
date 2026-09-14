import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ChatResponseType, MessageResponseType } from "@bakbak/contracts";
import { useAuth } from "@/features/auth/auth-context";
import { useSocket } from "@/features/chat/socket-context";
import { getChat } from "@/features/chat/api";
import { useNotifications } from "@/features/settings/notifications-context";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { playSound } from "@/lib/sounds";

interface ChatInfo {
  type: "DIRECT" | "GROUP";
  name: string | null;
  avatar: string | null;
}

function previewOf(msg: MessageResponseType): string {
  if (msg.deleted) return "Message deleted";
  const text = msg.text?.trim();
  if (text) return text;
  return msg.type === "IMAGE"
    ? "Photo"
    : msg.type === "VIDEO"
      ? "Video"
      : msg.type === "AUDIO"
        ? "Voice message"
        : "Attachment";
}

/**
 * Renders nothing. Turns `message:new` socket events into an in-app toast
 * when the message is from someone else and lands in a conversation the user
 * isn't currently viewing. Group toasts show the group name + photo; direct
 * toasts show the sender. Clicking opens the chat.
 */
export function MessageToastBridge() {
  const socket = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();
  const { prefs } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const currentUserId = user?.id;
  const openChatId = location.pathname.startsWith("/chats/")
    ? location.pathname.slice("/chats/".length)
    : null;
  const openChatIdRef = useRef(openChatId);
  openChatIdRef.current = openChatId;

  // chatId -> lightweight metadata for the toast, filled lazily.
  const chatInfo = useRef(new Map<string, ChatInfo>());

  useEffect(() => {
    if (!socket) return;

    const show = (msg: MessageResponseType, info: ChatInfo | undefined) => {
      const senderName =
        msg.sender?.profile?.displayName ||
        msg.sender?.username ||
        "New message";
      const isGroup = info?.type === "GROUP";
      const groupName = info?.name || "Group";

      toast({
        title: isGroup ? `${senderName} in ${groupName}` : senderName,
        description: previewOf(msg),
        dedupeKey: `chat:${msg.chatId}`,
        onAction: () => navigate(`/chats/${msg.chatId}`),
        // The sender is always the face on the left; a group message wears
        // the group's photo as a small badge so you know where it landed.
        icon: (
          <span className="relative block">
            <Avatar
              name={senderName}
              src={msg.sender?.profile?.avatar}
              className="size-10"
            />
            {isGroup && (
              <Avatar
                name={groupName}
                src={info?.avatar}
                className="absolute -right-1 -bottom-1 size-5 rounded-full text-[10px] ring-2 ring-white dark:ring-[#10151b]"
              />
            )}
          </span>
        ),
      });
    };

    const onNewMessage = (msg: MessageResponseType) => {
      if (!msg || msg.senderId === currentUserId) return;
      if (msg.chatId === openChatIdRef.current) return;

      // The chime is the "Sounds" toggle's; it plays even when in-app toasts
      // are off, so Messages OFF mutes only the visual notifications.
      playSound("message");

      if (!prefs.messages) return;

      const cached = chatInfo.current.get(msg.chatId);
      if (cached) {
        show(msg, cached);
        return;
      }
      getChat(msg.chatId)
        .then((chat) => {
          const info: ChatInfo = {
            type: chat.type,
            name: chat.name ?? null,
            avatar: chat.avatar ?? null,
          };
          chatInfo.current.set(msg.chatId, info);
          show(msg, info);
        })
        .catch(() => show(msg, undefined));
    };

    const onChatUpdated = (chat: ChatResponseType) => {
      if (!chat?.id) return;
      chatInfo.current.set(chat.id, {
        type: chat.type,
        name: chat.name ?? null,
        avatar: chat.avatar ?? null,
      });
    };

    socket.on("message:new", onNewMessage);
    socket.on("chat:updated", onChatUpdated);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("chat:updated", onChatUpdated);
    };
  }, [socket, currentUserId, toast, navigate, prefs.messages]);

  return null;
}
