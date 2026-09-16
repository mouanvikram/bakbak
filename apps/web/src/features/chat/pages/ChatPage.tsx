import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Info,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Reply,
  SendHorizontal,
  Smile,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useChatPreferences } from "@/features/settings/chat-preferences-context";
import { useSocket } from "@/features/chat/socket-context";
import { usePresence } from "@/features/chat/presence-context";
import { useSocketEvent } from "@/features/chat/hooks/use-socket-event";
import {
  useChatRoom,
  useTypingIndicator,
} from "@/features/chat/hooks/use-typing-indicator";
import { getChat } from "@/features/chat/api";
import {
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markChatRead,
  toggleReaction,
} from "@/features/messages/api";
import { uploadFile } from "@/lib/api/upload";
import type { ChatResponseType } from "@bakbak/contracts";
import type { MessageResponseType } from "@bakbak/contracts";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { GroupInfoModal } from "@/features/chat/components/GroupInfoModal";
import { DirectInfoModal } from "@/features/chat/components/DirectInfoModal";
import { MessageBubble } from "@/features/chat/components/MessageBubble";
import { EmojiPopover } from "@/features/chat/components/EmojiPopover";
import { EmptyState } from "@/components/ui/States";
import { MessageThreadSkeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { playSound } from "@/lib/sounds";
import { reportError } from "@/lib/report";
import { cn, formatLastSeen } from "@/lib/utils";

/** Files the composer lets you attach. Anything the API rejects still surfaces
 * an error toast. */
const ATTACHMENT_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

/** Threads read oldest-first, and both the API and the socket can hand us a
 *  message that belongs earlier than the last one we have. */
function byCreatedAt(a: MessageResponseType, b: MessageResponseType) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const { isOnline, lastSeenAt } = usePresence();
  const { preferences } = useChatPreferences();
  const { toast, error: toastError } = useToast();
  const [chat, setChat] = useState<ChatResponseType | null>(null);
  const [messages, setMessages] = useState<MessageResponseType[]>([]);
  // Ids that were already in the thread when it opened. Only messages outside
  // this set play the arrival animation, so opening a chat stays still.
  const [initialIds, setInitialIds] = useState<Set<string> | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The message being edited in the composer, or null for a normal compose.
  const [editing, setEditing] = useState<{
    id: string;
    original: string;
  } | null>(null);
  // The message being answered in the composer (reply); mutually exclusive
  // with `editing`.
  const [replyTarget, setReplyTarget] = useState<MessageResponseType | null>(
    null,
  );
  // Right-click menu on a message.
  const [msgMenu, setMsgMenu] = useState<{
    x: number;
    y: number;
    message: MessageResponseType;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Idempotency key for the in-flight / last-failed text send, so retrying the
  // same message doesn't create a duplicate. Scoped by chat id and reply target
  // so two different messages can't collide on one key.
  const pendingSend = useRef<{
    clientId: string;
    content: string;
    replyToId?: string;
  } | null>(null);
  // participantId -> id of the last message that participant has read.
  const [readState, setReadState] = useState<Record<string, string | null>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  // The message the thread just jumped to (from a reply quote), outlined
  // for a moment so the eye can find it.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserId = user?.id;
  const typingUsers = useTypingIndicator(socket, id, currentUserId);

  // Everything that has to start over when the open chat changes.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // A pending clientId is scoped to the chat it was sent in — switching
    // chats must never let it get reused (and possibly matched) elsewhere.
    // A reply target is scoped to its chat too.
    pendingSend.current = null;
    setReplyTarget(null);
    setLoading(true);
    setError("");
    setInitialIds(null);
    Promise.all([getChat(id), listMessages(id)])
      .then(([chatRes, msgRes]) => {
        if (cancelled) return;
        setChat(chatRes);
        setReadState(
          Object.fromEntries(
            (chatRes.participants ?? []).map((p) => [
              p.userId,
              p.lastReadMessageId ?? null,
            ]),
          ),
        );
        const sorted = [...msgRes.messages].sort(byCreatedAt);
        setMessages(sorted);
        setInitialIds(new Set(sorted.map((m) => m.id)));
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load chat");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // The server broadcasts the read receipt to the other participants as a
    // side effect of this call, so there's nothing to emit over the socket.
    void markChatRead(id).catch((err: unknown) =>
      reportError("messages:markRead", err),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Real-time events from Socket.IO. Each handler is re-read through a ref on
  // every event, so none of them resubscribe as this component's state moves.
  useChatRoom(socket, id);

  const replaceMessage = (message: MessageResponseType) => {
    if (message.chatId !== id) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  };

  useSocketEvent<MessageResponseType>(socket, "message:new", (message) => {
    if (message.chatId !== id) return;
    setMessages((prev) =>
      prev.some((m) => m.id === message.id)
        ? prev
        : [...prev, message].sort(byCreatedAt),
    );
    if (message.senderId !== currentUserId) {
      playSound("receive");
      void markChatRead(message.chatId).catch((err: unknown) =>
        reportError("messages:markRead", err),
      );
    }
  });

  useSocketEvent<MessageResponseType>(socket, "message:edited", replaceMessage);
  useSocketEvent<MessageResponseType>(
    socket,
    "message:deleted",
    replaceMessage,
  );
  useSocketEvent<MessageResponseType>(
    socket,
    "message:reaction",
    replaceMessage,
  );

  useSocketEvent<{ chatId: string; userId: string; messageId: string }>(
    socket,
    "read:receipt",
    (data) => {
      if (data.chatId !== id) return;
      setReadState((prev) => ({ ...prev, [data.userId]: data.messageId }));
    },
  );

  useSocketEvent<ChatResponseType>(socket, "chat:updated", (updated) => {
    if (updated?.id !== id) return;
    const stillIn = updated.participants?.some(
      (p) => p.userId === currentUserId,
    );
    if (!stillIn) {
      navigate("/chats", { replace: true });
      return;
    }
    setChat((prev) =>
      prev ? { ...prev, ...updated, messages: prev.messages } : updated,
    );
  });

  useEffect(() => {
    // Jump straight to the bottom when a thread opens; glide when a new
    // message arrives in one that's already on screen.
    const glide =
      !loading &&
      initialIds !== null &&
      messages.length > initialIds.size &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: glide ? "smooth" : "auto" });
  }, [messages, loading, initialIds]);

  function upsertMessage(next: MessageResponseType) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === next.id)) {
        return prev.map((m) => (m.id === next.id ? next : m));
      }
      return [...prev, next].sort(byCreatedAt);
    });
  }

  async function handleReaction(message: MessageResponseType, emoji: string) {
    if (!id || message.deleted) return;
    // Sound on adding only, and right away rather than after the round trip.
    const removing = message.reactions?.some(
      (r) => r.emoji === emoji && r.userId === currentUserId,
    );
    if (!removing) playSound("reaction");
    try {
      const res = await toggleReaction(id, message.id, emoji);
      upsertMessage(res);
    } catch {
      toastError("Couldn't update reaction");
    }
  }

  async function handleSend() {
    const content = text.trim();
    if (!id || sending || uploading) return;

    if (editing) {
      if (!content || content === editing.original) {
        setEditing(null);
        setText("");
        return;
      }
      setSending(true);
      setError("");
      try {
        const res = await editMessage(editing.id, { text: content });
        upsertMessage(res);
        playSound("edit");
        setEditing(null);
        setText("");
      } catch {
        setError("Failed to edit message");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!content) return;

    // Reuse the key when retrying the exact same message (same text + target).
    const replyToId = replyTarget?.id;
    const clientId =
      pendingSend.current?.content === content &&
      pendingSend.current?.replyToId === replyToId
        ? pendingSend.current.clientId
        : crypto.randomUUID();
    pendingSend.current = { clientId, content, replyToId };

    setSending(true);
    setError("");
    if (socket && socket.connected) {
      socket.emit("typing", { chatId: id, isTyping: false });
    }
    try {
      const res = await sendMessage(id, {
        text: content,
        clientId,
        ...(replyToId ? { replyToId } : {}),
      });
      pendingSend.current = null;
      playSound("send");
      setText("");
      setReplyTarget(null);
      // The socket may also deliver it; dedupe on id in onNewMessage.
      upsertMessage(res);
    } catch {
      // Keep pendingSend so the next attempt reuses `clientId`.
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!id || !files?.length) return;
    setEmojiOpen(false);
    setUploading(true);
    setError("");
    // The composer text rides along as a caption on the first file.
    let caption = text.trim();
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadFile(file, file.name);
        const res = await sendMessage(id, {
          attachmentIds: [attachment.id],
          clientId: crypto.randomUUID(),
          ...(caption ? { text: caption } : {}),
          ...(replyTarget?.id ? { replyToId: replyTarget.id } : {}),
        });
        caption = "";
        setText("");
        setReplyTarget(null);
        upsertMessage(res);
        playSound("upload");
      }
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Couldn't send that attachment",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function startEdit(message: MessageResponseType) {
    setReplyTarget(null);
    setEditing({ id: message.id, original: message.text ?? "" });
    setText(message.text ?? "");
    setEmojiOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  function startReply(message: MessageResponseType) {
    setEditing(null);
    setReplyTarget(message);
    setEmojiOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelReply() {
    setReplyTarget(null);
  }

  function jumpToMessage(messageId: string) {
    const el = threadRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    );
    if (!el) {
      toast({
        title: "Original message isn't loaded",
        description: "It's further back than this conversation shows.",
        variant: "info",
      });
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    playSound("jump");
    setHighlightedId(messageId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 1600);
  }

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  async function confirmDeleteMessage() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteMessage(deleteTarget);
      upsertMessage(res);
      playSound("delete");
      if (editing?.id === deleteTarget) cancelEdit();
    } catch {
      toastError("Failed to delete message");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function handleTyping(typing: boolean) {
    if (!id) return;
    if (!socket || !socket.connected) return;
    socket.emit("typing", { chatId: id, isTyping: typing });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // "Enter to send" on: Enter sends, Shift+Enter is a newline.
    // Off: only Ctrl/⌘+Enter sends, so Enter always makes a newline.
    const sendCombo = preferences.enterToSend
      ? event.key === "Enter" && !event.shiftKey
      : event.key === "Enter" && (event.metaKey || event.ctrlKey);
    if (sendCombo) {
      event.preventDefault();
      void handleSend();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (editing) {
        cancelEdit();
      } else if (replyTarget) {
        cancelReply();
      }
    }
  }

  if (!id) {
    return <div className="p-6 text-sm text-gray-500">Chat not found</div>;
  }

  const otherParticipant = chat?.participants?.find(
    (p) => p.user.id !== currentUserId,
  );
  const otherOnline = otherParticipant
    ? isOnline(otherParticipant.user.id)
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
        : formatLastSeen(
            // Newer of the live presence value and the one loaded with the chat.
            lastSeenAt(
              otherParticipant?.user.id,
              otherParticipant?.user.profile?.lastSeenAt,
            ),
          )
    : "";

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0].username} is typing...`
      : typingUsers.length > 1
        ? "Several people are typing..."
        : "";

  // Delivery status for the messages I sent, in a 1:1 chat:
  //   sent      — stored on the server
  //   delivered — the other person's socket is in the room
  //   seen      — their read pointer has reached this message
  const isDirect = chat?.type === "DIRECT";
  const isGroup = chat?.type === "GROUP";
  const otherReadId = otherParticipant
    ? (readState[otherParticipant.user.id] ?? null)
    : null;
  const orderIndex = new Map(messages.map((m, i) => [m.id, i] as const));
  const messageStatus = (messageId: string): "sent" | "delivered" | "seen" => {
    if (!isDirect || !otherParticipant) return "sent";
    if (otherReadId) {
      const readAt = orderIndex.get(otherReadId);
      const at = orderIndex.get(messageId);
      if (readAt !== undefined && at !== undefined && readAt >= at)
        return "seen";
    }
    return otherOnline ? "delivered" : "sent";
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Mobile header */}
      <header className="flex shrink-0 items-center gap-1 border-b border-gray-100 bg-white px-2 py-2 lg:hidden">
        <IconButton
          label="Go back"
          size="sm"
          className="-ml-0.5 text-gray-600"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-5" />
        </IconButton>
        <button
          type="button"
          disabled={!chat}
          onClick={() => setInfoOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left disabled:cursor-default"
        >
          <Avatar
            name={displayName}
            src={avatarSrc}
            className="size-8"
            online={isDirect && otherOnline}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-gray-500">{subtitle}</p>
          </div>
        </button>
        {(isGroup || isDirect) && (
          <IconButton
            label={isGroup ? "Group info" : "Contact info"}
            size="sm"
            aria-haspopup="dialog"
            className="text-gray-500"
            onClick={() => setInfoOpen(true)}
          >
            <Info className="size-5" />
          </IconButton>
        )}
      </header>

      {/* Desktop header */}
      <header className="hidden shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-2.5 lg:flex">
        <button
          type="button"
          disabled={!chat}
          onClick={() => setInfoOpen(true)}
          className="flex min-w-0 items-center gap-3 rounded-lg text-left transition-colors enabled:hover:bg-slate-50 disabled:cursor-default"
        >
          <Avatar
            name={displayName}
            src={avatarSrc}
            className="size-10"
            online={isDirect && otherOnline}
          />
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-gray-900">
              {displayName}
            </h2>
            <p className="truncate text-xs text-gray-500">{subtitle}</p>
          </div>
        </button>
        <div className="flex items-center gap-0.5">
          {isDirect && (
            <>
              <IconButton label="Voice call" className="hover:text-violet-600">
                <Phone className="size-5" />
              </IconButton>
              <IconButton label="Video call" className="hover:text-violet-600">
                <Video className="size-5" />
              </IconButton>
            </>
          )}
          {(isGroup || isDirect) && (
            <IconButton
              label={isGroup ? "Group info" : "Contact info"}
              aria-haspopup="dialog"
              className="hover:text-violet-600"
              onClick={() => setInfoOpen(true)}
            >
              <Info className="size-5" />
            </IconButton>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={threadRef}
        className="chat-surface min-h-0 flex-1 overflow-y-auto"
      >
        {loading ? (
          <MessageThreadSkeleton />
        ) : error && messages.length === 0 ? (
          <EmptyState text={error} />
        ) : messages.length === 0 ? (
          <EmptyState text="No messages yet. Say hi!" />
        ) : (
          <div className="flex flex-col gap-1.5 p-4">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.senderId === currentUserId}
                currentUserId={currentUserId ?? ""}
                isGroup={chat?.type === "GROUP"}
                isEditing={editing?.id === m.id}
                mediaPreview={preferences.mediaPreview}
                status={messageStatus(m.id)}
                animateIn={initialIds !== null && !initialIds.has(m.id)}
                highlighted={highlightedId === m.id}
                onJumpToReply={
                  m.replyToId ? () => jumpToMessage(m.replyToId!) : undefined
                }
                onReaction={(emoji) => void handleReaction(m, emoji)}
                onContextMenu={(e) => {
                  if (m.deleted) return;
                  e.preventDefault();
                  setMsgMenu({ x: e.clientX, y: e.clientY, message: m });
                }}
              />
            ))}
            {typingLabel && (
              <div className="flex items-center gap-2 px-1 py-1 text-xs text-gray-500 motion-safe:animate-[slide-up-in_180ms_var(--ease-emphasized)]">
                <span
                  aria-hidden
                  className="msg-bubble-in flex items-center gap-0.5 rounded-full px-2 py-1.5 shadow-sm"
                >
                  {["0ms", "150ms", "300ms"].map((delay) => (
                    <span
                      key={delay}
                      style={{ animationDelay: delay }}
                      className="size-1.5 rounded-full bg-slate-400 motion-safe:animate-[typing-dot_1.2s_ease-in-out_infinite]"
                    />
                  ))}
                </span>
                <span>{typingLabel}</span>
              </div>
            )}
            <div ref={bottomRef} className="h-1 w-full" />
          </div>
        )}
      </div>

      {/* Composer */}
      {error && messages.length > 0 && (
        <div className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-600 motion-safe:animate-[slide-up-in_180ms_var(--ease-emphasized)]">
          {error}
        </div>
      )}
      <div className="shrink-0 border-t border-gray-100 bg-white p-3">
        {editing && (
          <div className="bg-brand-500/10 text-brand-600 mb-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs motion-safe:animate-[slide-up-in_160ms_var(--ease-emphasized)]">
            <Pencil className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Editing message</span>
            <button
              type="button"
              onClick={cancelEdit}
              className="hover:bg-brand-500/15 shrink-0 rounded p-0.5"
              aria-label="Cancel editing"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {replyTarget && (
          <div
            key={replyTarget.id}
            className="bg-brand-500/10 text-brand-600 mb-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs motion-safe:animate-[slide-up-in_160ms_var(--ease-emphasized)]"
          >
            <MessageSquare className="size-3.5 shrink-0" />
            <button
              type="button"
              onClick={() => jumpToMessage(replyTarget.id)}
              className="min-w-0 flex-1 truncate rounded text-left hover:underline"
            >
              Replying to{" "}
              {replyTarget.sender.profile?.displayName ??
                replyTarget.sender.username}
            </button>
            <button
              type="button"
              onClick={cancelReply}
              className="hover:bg-brand-500/15 shrink-0 rounded p-0.5"
              aria-label="Cancel reply"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="relative flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <IconButton
            label="Attach a file"
            size="sm"
            disabled={sending || uploading || !!editing}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Spinner className="size-4" />
            ) : (
              <Paperclip className="size-5" />
            )}
          </IconButton>
          <IconButton
            label="Emoji"
            size="sm"
            aria-expanded={emojiOpen}
            className={cn(emojiOpen && "bg-slate-100 text-slate-900")}
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <Smile className="size-5" />
          </IconButton>
          {emojiOpen && (
            <EmojiPopover
              onPick={insertEmoji}
              onClose={() => setEmojiOpen(false)}
            />
          )}
          <textarea
            ref={textareaRef}
            value={text}
            disabled={sending || uploading}
            onChange={(e) => {
              const value = e.target.value;
              // Key click on every edit. onChange rather than keydown so
              // phone keyboards, which don't report keys, click too.
              playSound("typing");
              setText(value);
              if (!editing) handleTyping(value.trim().length > 0);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              editing
                ? "Edit your message"
                : replyTarget
                  ? `Reply to ${replyTarget.sender.profile?.displayName ?? replyTarget.sender.username}`
                  : preferences.enterToSend
                    ? "Type a message"
                    : "Type a message (Ctrl+Enter to send)"
            }
            className="focus:border-brand-500 focus:ring-brand-500/15 max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            aria-label={editing ? "Save changes" : "Send message"}
            disabled={!text.trim() || sending || uploading}
            onClick={handleSend}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-[#805FF8] to-[#4C18EF] text-white shadow-sm transition-all enabled:active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Spinner className="size-4" />
            ) : editing ? (
              <Check className="size-5" />
            ) : (
              <SendHorizontal className="size-5" />
            )}
          </button>
        </div>
      </div>

      {infoOpen && chat && isGroup && (
        <GroupInfoModal
          chat={chat}
          currentUserId={currentUserId}
          onClose={() => setInfoOpen(false)}
          onUpdated={setChat}
          onLeave={() => {
            setInfoOpen(false);
            navigate("/chats");
          }}
        />
      )}

      {infoOpen && chat && isDirect && otherParticipant && (
        <DirectInfoModal
          username={otherParticipant.user.username}
          fallbackName={displayName}
          fallbackAvatar={avatarSrc}
          onClose={() => setInfoOpen(false)}
        />
      )}

      {msgMenu && (
        <ContextMenu
          x={msgMenu.x}
          y={msgMenu.y}
          onClose={() => setMsgMenu(null)}
          items={[
            {
              label: "Reply",
              icon: <Reply />,
              onSelect: () => startReply(msgMenu.message),
            },
            // Only the sender can change or remove a message.
            ...(msgMenu.message.senderId === currentUserId
              ? [
                  ...(msgMenu.message.text
                    ? [
                        {
                          label: "Edit",
                          icon: <Pencil />,
                          onSelect: () => startEdit(msgMenu.message),
                        },
                      ]
                    : []),
                  {
                    label: "Delete",
                    icon: <Trash2 />,
                    destructive: true,
                    onSelect: () => setDeleteTarget(msgMenu.message.id),
                  },
                ]
              : []),
          ]}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete message"
          message="This message will be removed for everyone in the chat."
          confirmLabel="Delete"
          destructive
          loading={deleting}
          onConfirm={confirmDeleteMessage}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
