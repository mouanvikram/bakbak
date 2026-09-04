import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Info,
  Paperclip,
  Pencil,
  Phone,
  SendHorizontal,
  Smile,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useChatPreferences } from "@/features/settings/chat-preferences-context";
import { useSocket } from "@/features/chat/socket-context";
import { getChat } from "@/features/chat/api";
import {
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markChatRead,
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
import { cn } from "@/lib/utils";

/** Files the composer lets you attach. Anything the API rejects still surfaces
 * an error toast. */
const ATTACHMENT_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

interface TypingUser {
  userId: string;
  username: string;
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const { preferences } = useChatPreferences();
  const { error: toastError } = useToast();
  const [chat, setChat] = useState<ChatResponseType | null>(null);
  const [messages, setMessages] = useState<MessageResponseType[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The message being edited in the composer, or null for a normal compose.
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(
    null,
  );
  // Right-click menu on one of my messages.
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
  // same message doesn't create a duplicate.
  const pendingSend = useRef<{ clientId: string; content: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  // participantId -> id of the last message that participant has read.
  const [readState, setReadState] = useState<Record<string, string | null>>({});
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
        setReadState(
          Object.fromEntries(
            (chatRes.participants ?? []).map((p) => [
              p.userId,
              p.lastReadMessageId ?? null,
            ]),
          ),
        );
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

    const onReadReceipt = (data: {
      chatId: string;
      userId: string;
      messageId: string;
    }) => {
      if (data.chatId !== id) return;
      setReadState((prev) => ({ ...prev, [data.userId]: data.messageId }));
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

    const onChatUpdated = (updated: ChatResponseType) => {
      if (updated?.id !== id) return;
      const stillIn = updated.participants?.some(
        (p) => p.userId === currentUserId,
      );
      if (!stillIn) {
        navigate("/chats", { replace: true });
        return;
      }
      setChat((prev) => (prev ? { ...prev, ...updated, messages: prev.messages } : updated));
    };

    s.on("connect", onConnect);
    s.on("presence:state", onPresenceState);
    s.on("message:new", onNewMessage);
    s.on("message:edited", onMessageEdited);
    s.on("message:deleted", onMessageDeleted);
    s.on("typing", onTyping);
    s.on("presence", onPresence);
    s.on("read:receipt", onReadReceipt);
    s.on("chat:updated", onChatUpdated);

    return () => {
      s.off("connect", onConnect);
      s.off("presence:state", onPresenceState);
      s.off("message:new", onNewMessage);
      s.off("message:edited", onMessageEdited);
      s.off("message:deleted", onMessageDeleted);
      s.off("typing", onTyping);
      s.off("presence", onPresence);
      s.off("read:receipt", onReadReceipt);
      s.off("chat:updated", onChatUpdated);
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [id, currentUserId, socket, navigate]);

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

  function upsertMessage(next: MessageResponseType) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === next.id)) {
        return prev.map((m) => (m.id === next.id ? next : m));
      }
      return [...prev, next].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }

  async function handleSend() {
    const content = text.trim();
    if (!id || sending || uploading) return;

    // Editing an existing message rather than sending a new one.
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

    // Reuse the key when retrying the exact same message.
    const clientId =
      pendingSend.current?.content === content
        ? pendingSend.current.clientId
        : crypto.randomUUID();
    pendingSend.current = { clientId, content };

    setSending(true);
    setError("");
    // Stop typing indicator when sending.
    if (socket && socket.connected) {
      socket.emit("typing", { chatId: id, isTyping: false });
    }
    try {
      const res = await sendMessage(id, { text: content, clientId });
      pendingSend.current = null;
      // REST call returns the saved message; add it locally.
      setText("");
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
        });
        caption = "";
        setText("");
        upsertMessage(res);
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
    setEditing({ id: message.id, original: message.text ?? "" });
    setText(message.text ?? "");
    setEmojiOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteMessage(deleteTarget);
      upsertMessage(res);
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
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      cancelEdit();
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
  const messageStatus = (
    messageId: string,
  ): "sent" | "delivered" | "seen" => {
    if (!isDirect || !otherParticipant) return "sent";
    if (otherReadId) {
      const readAt = orderIndex.get(otherReadId);
      const at = orderIndex.get(messageId);
      if (readAt !== undefined && at !== undefined && readAt >= at) return "seen";
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
      <div className="chat-surface min-h-0 flex-1 overflow-y-auto">
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
                isGroup={chat?.type === "GROUP"}
                isEditing={editing?.id === m.id}
                mediaPreview={preferences.mediaPreview}
                status={messageStatus(m.id)}
                onContextMenu={(e) => {
                  if (m.senderId !== currentUserId || m.deleted) return;
                  e.preventDefault();
                  setMsgMenu({ x: e.clientX, y: e.clientY, message: m });
                }}
              />
            ))}
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
        {editing && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs text-brand-600">
            <Pencil className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Editing message
            </span>
            <button
              type="button"
              onClick={cancelEdit}
              className="shrink-0 rounded p-0.5 hover:bg-brand-500/15"
              aria-label="Cancel editing"
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
              setText(value);
              if (!editing) handleTyping(value.trim().length > 0);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              editing
                ? "Edit your message"
                : preferences.enterToSend
                  ? "Type a message"
                  : "Type a message (Ctrl+Enter to send)"
            }
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 transition outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-60"
          />
          <button
            type="button"
            aria-label={editing ? "Save changes" : "Send message"}
            disabled={!text.trim() || sending || uploading}
            onClick={handleSend}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-[#805FF8] to-[#4C18EF] text-white shadow-sm transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
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
