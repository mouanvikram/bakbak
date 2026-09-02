import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Info, Phone, SendHorizontal, Video } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useSocket } from "@/features/chat/socket-context";
import { getChat } from "@/features/chat/api";
import {
  listMessages,
  sendMessage,
  markChatRead,
} from "@/features/messages/api";
import type { ChatResponseType } from "@bakbak/contracts";
import type { MessageResponseType } from "@bakbak/contracts";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TypingUser {
  userId: string;
  username: string;
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const [chat, setChat] = useState<ChatResponseType | null>(null);
  const [messages, setMessages] = useState<MessageResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  // userId -> timer that drops a stale "typing" indicator if no stop arrives.
  const typingExpiry = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const currentUserId = user?.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([getChat(id), listMessages(id)])
      .then(([chatRes, msgRes]) => {
        if (cancelled) return;
        setChat(chatRes);
        const sorted = [...msgRes.messages].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setMessages(sorted);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load chat");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Real-time events from Socket.IO
  useEffect(() => {
    if (!socket || !id) return;

    const s = socket;
    const timers = typingExpiry.current;

    // Switching chats: drop any state carried over from the previous room.
    setTypingUsers([]);
    setOnlineUsers(new Set());

    const clearTypingUser = (uid: string) => {
      const t = timers.get(uid);
      if (t) {
        clearTimeout(t);
        timers.delete(uid);
      }
      setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));
    };

    const onConnect = () => {
      // Auto-join at connect time covers existing chats; re-emit so a chat
      // opened before the socket finished connecting is joined too.
      s.emit("chat:join", id);
    };

    const onPresenceState = (data: { chatId: string; online: string[] }) => {
      if (data.chatId !== id) return;
      setOnlineUsers(new Set(data.online));
    };

    const onNewMessage = (message: MessageResponseType) => {
      if (message.chatId !== id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      // If the incoming message is from someone else, mark as read.
      if (message.senderId !== currentUserId) {
        void markChatRead(id ?? "").catch(() => {});
      }
    };

    const onMessageEdited = (message: MessageResponseType) => {
      if (message.chatId !== id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
    };

    const onMessageDeleted = (message: MessageResponseType) => {
      if (message.chatId !== id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m)),
      );
    };

    const onTyping = (data: {
      chatId: string;
      userId: string;
      username: string;
      isTyping: boolean;
    }) => {
      if (data.chatId !== id) return;
      if (data.userId === currentUserId) return;
      if (!data.isTyping) {
        clearTypingUser(data.userId);
        return;
      }
      setTypingUsers((prev) =>
        prev.some((u) => u.userId === data.userId)
          ? prev
          : [...prev, { userId: data.userId, username: data.username }],
      );
      // Safety net in case the matching "stopped typing" event is missed.
      const existing = timers.get(data.userId);
      if (existing) clearTimeout(existing);
      timers.set(
        data.userId,
        setTimeout(() => clearTypingUser(data.userId), 6_000),
      );
    };

    const onPresence = (data: { userId: string; online: boolean }) => {
      if (!id) return;
      // Ignore own presence.
      if (data.userId === currentUserId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.online) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    };

    s.on("connect", onConnect);
    s.on("presence:state", onPresenceState);
    s.on("message:new", onNewMessage);
    s.on("message:edited", onMessageEdited);
    s.on("message:deleted", onMessageDeleted);
    s.on("typing", onTyping);
    s.on("presence", onPresence);

    return () => {
      s.off("connect", onConnect);
      s.off("presence:state", onPresenceState);
      s.off("message:new", onNewMessage);
      s.off("message:edited", onMessageEdited);
      s.off("message:deleted", onMessageDeleted);
      s.off("typing", onTyping);
      s.off("presence", onPresence);
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [id, currentUserId, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, loading]);

  useEffect(() => {
    if (!id || !socket) return;
    // Ensure this socket is in the chat's room. This matters for chats that
    // were created *after* the socket initially connected (e.g. starting a
    // new conversation) — auto-join at connect time won't have covered them.
    if (socket.connected) {
      socket.emit("chat:join", id);
    }
    // Tell the room we've stopped typing when navigating away.
    return () => {
      if (socket.connected) {
        socket.emit("typing", { chatId: id, isTyping: false });
      }
    };
  }, [id, socket]);

  useEffect(() => {
    if (!id) return;
    // The server broadcasts the read receipt to the other participants as a
    // side effect of this call, so there's nothing to emit over the socket.
    void markChatRead(id).catch(() => {});
  }, [id]);

  async function handleSend() {
    const content = text.trim();
    if (!id || !content || sending) return;
    setSending(true);
    setError("");
    // Stop typing indicator when sending.
    if (socket && socket.connected) {
      socket.emit("typing", { chatId: id, isTyping: false });
    }
    try {
      const res = await sendMessage(id, { text: content });
      // REST call returns the saved message; add it locally.
      setText("");
      // The socket may also deliver it; dedupe on id in onNewMessage.
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.id)) return prev;
        return [...prev, res].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleTyping(typing: boolean) {
    if (!id) return;
    if (!socket || !socket.connected) return;
    socket.emit("typing", { chatId: id, isTyping: typing });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  if (!id) {
    return <div className="p-6 text-sm text-gray-500">Chat not found</div>;
  }

  const otherParticipant = chat?.participants?.find(
    (p) => p.user.id !== currentUserId,
  );
  const otherOnline = otherParticipant
    ? onlineUsers.has(otherParticipant.user.id)
    : false;
  const displayName =
    chat?.type === "DIRECT"
      ? (otherParticipant?.user.profile?.displayName ??
        otherParticipant?.user.username ??
        "Unknown")
      : (chat?.name ?? "Group");
  const avatarSrc =
    chat?.type === "DIRECT"
      ? otherParticipant?.user.profile?.avatar
      : (chat?.avatar ?? null);
  const subtitle = chat
    ? chat.type === "GROUP"
      ? `${chat.participants?.length ?? 0} participants`
      : otherOnline
        ? "Online"
        : "Offline"
    : "";

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0].username} is typing...`
      : typingUsers.length > 1
        ? "Several people are typing..."
        : "";

  return (
    <div className="flex h-full w-full flex-col">
      {/* Mobile header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-2 py-2 lg:hidden">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="flex cursor-pointer items-center justify-center rounded-full p-1 text-gray-600 transition hover:bg-gray-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={displayName} src={avatarSrc} className="size-8" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {displayName}
          </p>
          <p className="truncate text-[11px] text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName} src={avatarSrc} className="size-10" />
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-gray-900">
              {displayName}
            </h2>
            <p className="truncate text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Call"
            className="flex cursor-pointer items-center justify-center rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-violet-600"
          >
            <Phone className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Video call"
            className="flex cursor-pointer items-center justify-center rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-violet-600"
          >
            <Video className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Chat info"
            className="flex cursor-pointer items-center justify-center rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-violet-600"
          >
            <Info className="size-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-surface min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState text="Loading messages..." />
        ) : error && messages.length === 0 ? (
          <EmptyState text={error} />
        ) : messages.length === 0 ? (
          <EmptyState text="No messages yet. Say hi!" />
        ) : (
          <div className="flex flex-col gap-1.5 p-4">
            {messages.map((m) => {
              const mine = m.senderId === currentUserId;
              const senderName =
                m.sender.profile?.displayName ?? m.sender.username ?? "";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  {!mine && chat?.type === "GROUP" && (
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <Avatar
                        name={senderName}
                        src={m.sender.profile?.avatar ?? undefined}
                        className="size-5"
                      />
                      <span className="px-1 text-[11px] font-medium text-slate-500">
                        {senderName}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                      mine
                        ? "rounded-br-md bg-linear-to-br from-[#805FF8] to-[#4C18EF] text-white"
                        : "rounded-bl-md bg-white text-gray-900",
                    )}
                  >
                    <p className="wrap-break-words whitespace-pre-wrap">
                      {m.deleted ? "This message was deleted" : (m.text ?? "")}
                    </p>
                    <div
                      className={cn(
                        "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                        mine ? "text-white/70" : "text-gray-400",
                      )}
                    >
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingLabel && (
              <div className="flex items-center gap-2 px-1 py-1 text-xs text-gray-500">
                <Spinner className="size-3" />
                <span>{typingLabel}</span>
              </div>
            )}
            <div ref={bottomRef} className="h-1 w-full" />
          </div>
        )}
      </div>

      {/* Composer */}
      {error && messages.length > 0 && (
        <div className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-600">
          {error}
        </div>
      )}
      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              handleTyping(value.trim().length > 0);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10"
          />
          <button
            type="button"
            aria-label="Send message"
            disabled={!text.trim() || sending}
            onClick={handleSend}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-[#805FF8] to-[#4C18EF] text-white shadow-sm transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Spinner className="size-4" />
            ) : (
              <SendHorizontal className="size-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
