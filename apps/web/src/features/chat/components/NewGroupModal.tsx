import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, Check, Search, X } from "lucide-react";
import type { FriendshipResponseType } from "@bakbak/contracts";
import { getFriends } from "@/features/friends/api";
import { createGroupChat, uploadGroupAvatar } from "@/features/chat/api";
import { ImageCropModal } from "@/components/ImageCropModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

const MIN_MEMBERS = 2;

function friendName(f: FriendshipResponseType): string {
  return f.friend.profile?.displayName || f.friend.username;
}

export function NewGroupModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [friends, setFriends] = useState<FriendshipResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    getFriends()
      .then((res) => setFriends(res.friendships))
      .catch(() => setError("Failed to load friends"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = friends.filter((f) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      friendName(f).toLowerCase().includes(q) ||
      f.friend.username.toLowerCase().includes(q)
    );
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    setAvatarUploading(true);
    setError("");
    try {
      const { key, url } = await uploadGroupAvatar(blob, "group.webp");
      setAvatarKey(key);
      setAvatarPreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  const enoughMembers = selected.size >= MIN_MEMBERS;
  const canCreate =
    name.trim().length > 0 && enoughMembers && !submitting && !avatarUploading;

  async function handleCreate() {
    if (!canCreate) return;
    setSubmitting(true);
    setError("");
    try {
      const chat = await createGroupChat({
        type: "GROUP",
        name: name.trim(),
        participantIds: [...selected],
        ...(avatarKey ? { avatar: avatarKey } : {}),
      });
      onClose();
      navigate(`/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
      setSubmitting(false);
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 motion-safe:animate-[fade-in_120ms_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl motion-safe:animate-[pop-in_150ms_var(--ease-emphasized)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h2
            id="new-group-title"
            className="text-base font-semibold text-slate-900"
          >
            New group
          </h2>
          <IconButton label="Close" size="sm" className="-mr-1" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>

        <div className="flex items-center gap-3 px-5 pt-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Add group photo"
            className="relative shrink-0 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Avatar name={name || "Group"} src={avatarPreview} className="size-14" />
            <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-white">
              {avatarUploading ? (
                <Spinner className="size-3" />
              ) : (
                <Camera className="size-3" />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={onPickFile}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            autoFocus
            maxLength={100}
            className="h-10 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 text-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-500/30"
          />
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search friends"
              className="h-10 w-full rounded-lg bg-slate-50 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-500/30"
            />
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {friends.length === 0
                ? "Add friends first to start a group."
                : "No friends match your search."}
            </p>
          ) : (
            visible.map((f) => {
              const isSel = selected.has(f.friend.id);
              return (
                <button
                  key={f.friendshipId}
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => toggle(f.friend.id)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <Avatar
                    name={friendName(f)}
                    src={f.friend.profile?.avatar ?? undefined}
                    className="size-9"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {friendName(f)}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSel
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-300 text-transparent group-hover:border-brand-400 group-hover:text-brand-400/50",
                    )}
                  >
                    <Check className="size-3 stroke-[3]" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          {error && (
            <p className="mb-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {enoughMembers
                ? `${selected.size} selected`
                : `Select at least ${MIN_MEMBERS} friends`}
            </span>
            <Button
              value="Create group"
              fullWidth={false}
              loading={submitting}
              loadingText="Creating…"
              disabled={!canCreate}
              onClick={handleCreate}
            />
          </div>
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
