import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  MoreVertical,
  SendHorizontal,
  Trash2,
} from "lucide-react";
import {
  deleteMessage,
  getErrorMessage,
  listMessages,
  markChatRead,
  sendMessage,
} from "../lib/api";
import { getChatAvatar, getChatTitle } from "../lib/chat";
import { cn, formatFullTime, getDisplayName } from "../lib/utils";
import type { Chat, Message } from "../types/api";
import { Avatar, Button, EmptyState, Spinner } from "./ui";

export function MessagePane({
  chat,
  currentUserId,
  onBack,
}: {
  chat: Chat | null;
  currentUserId?: string | null;
  onBack?: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messagesQuery = useQuery({
    queryKey: ["messages", chat?.id],
    queryFn: () => listMessages(chat!.id, { limit: 100 }),
    enabled: Boolean(chat?.id),
    refetchInterval: 3000,
  });

  const messages = useMemo(() => {
    const list = messagesQuery.data ?? [];
    // API returns newest-first; display oldest-first
    return [...list].reverse();
  }, [messagesQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, chat?.id]);

  useEffect(() => {
    if (!chat?.id || messages.length === 0) return;
    const last = messages[messages.length - 1];
    void markChatRead(chat.id, last.id).catch(() => undefined);
  }, [chat?.id, messages]);

  const sendMutation = useMutation({
    mutationFn: (value: string) =>
      sendMessage(chat!.id, { text: value, type: "TEXT" }),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(["messages", chat!.id], (old) => {
        const list = old ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [message, ...list];
      });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      setText("");
      setError(null);
      inputRef.current?.focus();
    },
    onError: (err) => setError(getErrorMessage(err, "Failed to send message")),
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", chat?.id] });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !chat || sendMutation.isPending) return;
    sendMutation.mutate(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const value = text.trim();
      if (!value || !chat || sendMutation.isPending) return;
      sendMutation.mutate(value);
    }
  };

  if (!chat) {
    return (
      <div className="hidden h-full flex-1 flex-col bg-surface-2 md:flex">
        <EmptyState
          icon={<MoreVertical className="h-7 w-7" />}
          title="Select a chat"
          description="Pick a conversation from the sidebar, or start a new one from Friends."
        />
      </div>
    );
  }

  const title = getChatTitle(chat, currentUserId);
  const avatar = getChatAvatar(chat, currentUserId);
  const subtitle =
    chat.type === "GROUP"
      ? `${chat.participants.length} members`
      : `@${chat.participants.find((p) => p.userId !== currentUserId)?.user.username ?? "user"}`;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5 md:px-4">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar name={title} src={avatar} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          <p className="truncate text-xs text-ink-muted">{subtitle}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-wallpaper scroll-thin relative flex-1 overflow-y-auto px-3 py-4 md:px-8">
        {messagesQuery.isLoading && (
          <div className="flex justify-center py-10">
            <Spinner className="text-accent" />
          </div>
        )}

        {messagesQuery.isError && (
          <div className="mx-auto max-w-md rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {getErrorMessage(messagesQuery.error, "Could not load messages")}
          </div>
        )}

        {!messagesQuery.isLoading && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-sm rounded-xl bg-surface/90 px-4 py-3 text-center text-sm text-ink-muted shadow-sm backdrop-blur">
            No messages yet. Say hello 👋
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            const senderName = getDisplayName(message.sender);

            return (
              <div
                key={message.id}
                className={cn(
                  "group flex",
                  mine ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "relative max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm md:max-w-[70%]",
                    mine
                      ? "rounded-br-sm bg-bubble-me"
                      : "rounded-bl-sm bg-bubble-them",
                  )}
                >
                  {!mine && chat.type === "GROUP" && (
                    <p className="mb-0.5 text-xs font-semibold text-accent">
                      {senderName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm text-ink">
                    {message.text}
                  </p>
                  <div className="mt-0.5 flex items-center justify-end gap-2">
                    <span className="text-[10px] text-ink-muted">
                      {formatFullTime(message.createdAt)}
                    </span>
                    {mine && (
                      <button
                        type="button"
                        title="Delete message"
                        className="opacity-0 transition group-hover:opacity-100 text-ink-muted hover:text-danger"
                        onClick={() => deleteMutation.mutate(message.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="border-t border-border bg-surface-2 px-3 py-3 md:px-4"
      >
        {error && (
          <p className="mb-2 text-center text-xs text-danger">{error}</p>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-full"
            disabled={!text.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <SendHorizontal className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
