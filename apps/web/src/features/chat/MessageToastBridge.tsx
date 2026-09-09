import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ChatResponseType, MessageResponseType } from "@bakbak/contracts";
import { useAuth } from "@/features/auth/auth-context";
import { useSocket } from "@/features/chat/socket-context";
import { getChat } from "@/features/chat/api";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";

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
      const preview = previewOf(msg);
      const isGroup = info?.type === "GROUP";

      const title = isGroup && info?.name ? info.name : senderName;
      const description = isGroup ? `${senderName}: ${preview}` : preview;
      const avatarSrc = isGroup ? info?.avatar : msg.sender?.profile?.avatar;

      toast({
        title,
        description,
        dedupeKey: `chat:${msg.chatId}`,
        onAction: () => navigate(`/chats/${msg.chatId}`),
        icon: (
          <Avatar
            name={isGroup ? info?.name || "Group" : senderName}
            src={avatarSrc}
            className="size-9"
          />
        ),
      });
    };

    const onNewMessage = (msg: MessageResponseType) => {
      if (!msg || msg.senderId === currentUserId) return;
      if (msg.chatId === openChatIdRef.current) return;

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
  }, [socket, currentUserId, toast, navigate]);

  return null;
}
