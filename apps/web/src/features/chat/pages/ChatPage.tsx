import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Info, Phone, SendHorizontal, Video } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { getChat } from "@/features/chat/api";
import { listMessages, sendMessage, markChatRead } from "@/features/messages/api";
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

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chat, setChat] = useState<ChatResponseType | null>(null);
  const [messages, setMessages] = useState<MessageResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, loading]);

  useEffect(() => {
    if (!id) return;
    void markChatRead(id).catch(() => {});
  }, [id]);

  async function handleSend() {
    const content = text.trim();
    if (!id || !content || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await sendMessage(id, { text: content });
      setMessages((prev) => [...prev, res]);
      setText("");
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
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
  const displayName =
    chat?.type === "DIRECT"
      ? otherParticipant?.user.profile?.displayName ??
        otherParticipant?.user.username ??
        "Unknown"
      : (chat?.name ?? "Group");
  const avatarSrc =
    chat?.type === "DIRECT"
      ? otherParticipant?.user.profile?.avatar
      : (chat?.avatar ?? null);
  const subtitle = chat
    ? chat.type === "GROUP"
      ? `${chat.participants?.length ?? 0} participants`
      : "Friend on BakBak"
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
      <div
        className="bg-cover bg-center min-h-0 flex-1 overflow-y-auto"
        style={{ backgroundImage: "url('/images/backgrounds/chat_bg_light.png')" }}
      >
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
                    <p className="whitespace-pre-wrap break-words">
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
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10"
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