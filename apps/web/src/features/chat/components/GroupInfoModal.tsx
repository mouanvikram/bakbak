import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Pencil,
  Plus,
  Search,
  UserMinus,
  X,
} from "lucide-react";
import type {
  ChatResponseType,
  FriendshipResponseType,
} from "@bakbak/contracts";
import {
  addParticipant,
  getChat,
  removeParticipant,
  updateChat,
  uploadGroupAvatar,
} from "@/features/chat/api";
import { getFriends } from "@/features/friends/api";
import { ImageCropModal } from "@/components/ImageCropModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";

type Participant = ChatResponseType["participants"][number];

function personName(p: {
  username: string;
  profile?: { displayName?: string | null } | null;
}) {
  return p.profile?.displayName || p.username;
}

export function GroupInfoModal({
  chat,
  currentUserId,
  onClose,
  onUpdated,
  onLeave,
}: {
  chat: ChatResponseType;
  currentUserId?: string;
  onClose: () => void;
  onUpdated: (chat: ChatResponseType) => void;
  onLeave: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const me = chat.participants.find((p) => p.userId === currentUserId);
  const isAdmin = me?.role === "ADMIN";

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(chat.name ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [friends, setFriends] = useState<FriendshipResponseType[]>([]);
  const [addQuery, setAddQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!addOpen || friends.length) return;
    getFriends()
      .then((res) => setFriends(res.friendships))
      .catch(() => setError("Failed to load friends"));
  }, [addOpen, friends.length]);

  const memberIds = useMemo(
    () => new Set(chat.participants.map((p) => p.userId)),
    [chat.participants],
  );

  const addable = friends.filter((f) => {
    if (memberIds.has(f.friend.id)) return false;
    const q = addQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      personName(f.friend).toLowerCase().includes(q) ||
      f.friend.username.toLowerCase().includes(q)
    );
  });

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      onUpdated(await getChat(chat.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function handleLeave() {
    if (!currentUserId) return;
    setBusy("leave");
    setError("");
    try {
      await removeParticipant(chat.id, currentUserId);
      onLeave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
      setBusy(null);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function onCrop(blob: Blob) {
    setCropSrc(null);
    await run("photo", async () => {
      const { key } = await uploadGroupAvatar(blob, "group.webp");
      await updateChat(chat.id, { avatar: key });
    });
  }

  function saveName() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === chat.name) return;
    void run("name", () => updateChat(chat.id, { name: next }));
  }

  const sortedMembers = [...chat.participants].sort((a, b) => {
    if (a.role !== b.role) return a.role === "ADMIN" ? -1 : 1;
    return personName(a.user).localeCompare(personName(b.user));
  });

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 motion-safe:animate-[fade-in_120ms_ease-out]"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-info-title"
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl motion-safe:animate-[pop-in_150ms_var(--ease-emphasized)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2
              id="group-info-title"
              className="text-base font-semibold text-slate-900"
            >
              Group info
            </h2>
            <IconButton
              label="Close"
              size="sm"
              className="-mr-1"
              onClick={onClose}
            >
              <X className="size-5" />
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
              <button
                type="button"
                disabled={!isAdmin || busy === "photo"}
                onClick={() => fileRef.current?.click()}
                aria-label="Change group photo"
                className="focus-visible:outline-brand-500 relative rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default"
              >
                <Avatar
                  name={chat.name || "Group"}
                  src={chat.avatar}
                  className="size-20"
                />
                {isAdmin && (
                  <span className="bg-brand-500 absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border-2 border-white text-white">
                    {busy === "photo" ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                onChange={onPickFile}
              />

              {editingName ? (
                <div className="flex w-full items-center gap-2">
                  <input
                    autoFocus
                    value={nameDraft}
                    maxLength={100}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    className="focus-visible:ring-brand-500/30 h-10 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 text-sm outline-none focus-visible:ring-2"
                  />
                  <IconButton label="Save name" size="sm" onClick={saveName}>
                    <Check className="size-5" />
                  </IconButton>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {chat.name}
                  </h3>
                  {isAdmin && (
                    <IconButton
                      label="Edit group name"
                      size="sm"
                      onClick={() => {
                        setNameDraft(chat.name ?? "");
                        setEditingName(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500">
                {chat.participants.length} members
              </p>
            </div>

            {error && (
              <p className="px-5 pb-2 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}

            {isAdmin && (
              <div className="border-t border-gray-100 px-2 py-2">
                {!addOpen ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="text-brand-600 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50"
                  >
                    <span className="bg-brand-500/10 text-brand-600 flex size-9 items-center justify-center rounded-full">
                      <Plus className="size-5" />
                    </span>
                    Add people
                  </button>
                ) : (
                  <div className="px-1">
                    <div className="relative">
                      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        autoFocus
                        value={addQuery}
                        onChange={(e) => setAddQuery(e.target.value)}
                        placeholder="Search friends"
                        className="focus-visible:ring-brand-500/30 h-10 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus-visible:ring-2"
                      />
                    </div>
                    <div className="mt-1 max-h-44 overflow-y-auto">
                      {addable.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-slate-500">
                          No friends left to add.
                        </p>
                      ) : (
                        addable.map((f) => (
                          <div
                            key={f.friendshipId}
                            className="flex items-center gap-3 rounded-lg px-3 py-2"
                          >
                            <Avatar
                              name={personName(f.friend)}
                              src={f.friend.profile?.avatar ?? undefined}
                              className="size-8"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                              {personName(f.friend)}
                            </span>
                            <Button
                              value="Add"
                              size="sm"
                              fullWidth={false}
                              loading={busy === `add:${f.friend.id}`}
                              disabled={busy !== null}
                              onClick={() =>
                                run(`add:${f.friend.id}`, () =>
                                  addParticipant(chat.id, {
                                    participantId: f.friend.id,
                                  }),
                                )
                              }
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-gray-100 px-2 py-2">
              <p className="px-3 pb-1 text-xs font-medium text-slate-500">
                Members
              </p>
              {sortedMembers.map((p: Participant) => {
                const isSelf = p.userId === currentUserId;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                  >
                    <Avatar
                      name={personName(p.user)}
                      src={p.user.profile?.avatar ?? undefined}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {personName(p.user)} {isSelf && "(You)"}
                      </p>
                      {p.role === "ADMIN" && (
                        <p className="text-brand-600 text-xs">Admin</p>
                      )}
                    </div>
                    {isAdmin && !isSelf && (
                      <IconButton
                        label={`Remove ${personName(p.user)}`}
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() =>
                          run(`remove:${p.userId}`, () =>
                            removeParticipant(chat.id, p.userId),
                          )
                        }
                      >
                        {busy === `remove:${p.userId}` ? (
                          <Spinner className="size-4" />
                        ) : (
                          <UserMinus className="size-5" />
                        )}
                      </IconButton>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-4">
            <Button
              value="Leave group"
              variant="danger"
              loading={busy === "leave"}
              disabled={busy !== null}
              onClick={handleLeave}
            />
          </div>
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          aspect={1}
          onCancel={() => setCropSrc(null)}
          onConfirm={onCrop}
        />
      )}
    </>
  );
}
