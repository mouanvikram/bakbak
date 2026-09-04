import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, Clock, UserPlus, Users, X } from "lucide-react";
import type { GetProfileResponseType } from "@bakbak/contracts";
import { getProfile } from "@/features/users/api";
import {
  acceptFriendRequest,
  sendFriendRequest,
} from "@/features/friends/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";

function joinedLabel(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

/**
 * Contact info for the other person in a direct chat: photo, name, bio, their
 * friend count, and a friend-request action reflecting the current relationship.
 */
export function DirectInfoModal({
  username,
  fallbackName,
  fallbackAvatar,
  onClose,
}: {
  username: string;
  fallbackName: string;
  fallbackAvatar?: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<GetProfileResponseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getProfile(username)
      .then((p) => {
        setProfile(p);
        setError("");
      })
      .catch(() => setError("Couldn't load this profile"))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const name =
    profile?.displayName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    fallbackName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 motion-safe:animate-[fade-in_120ms_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-info-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl motion-safe:animate-[pop-in_150ms_var(--ease-emphasized)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h2
            id="contact-info-title"
            className="text-base font-semibold text-slate-900"
          >
            Contact info
          </h2>
          <IconButton label="Close" size="sm" className="-mr-1" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-6 text-slate-400" />
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
                <Avatar
                  name={name}
                  src={profile?.avatar ?? fallbackAvatar}
                  className="size-24"
                />
                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {name}
                    </h3>
                    {profile?.verified && (
                      <BadgeCheck
                        className="size-4 text-brand-500"
                        aria-label="Verified"
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    @{profile?.username ?? username}
                  </p>
                </div>

                {profile?.bio && (
                  <p className="max-w-xs text-sm text-slate-600">{profile.bio}</p>
                )}

                <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {profile?.friendsCount ?? 0}{" "}
                    {profile?.friendsCount === 1 ? "friend" : "friends"}
                  </span>
                  {profile?.joinedAt && (
                    <span>Joined {joinedLabel(profile.joinedAt)}</span>
                  )}
                </div>
              </div>

              {error && (
                <p className="px-5 pb-2 text-center text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}

              {profile && profile.friendshipStatus !== "self" && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <FriendAction
                    profile={profile}
                    busy={busy}
                    onAdd={() => act(() => sendFriendRequest(profile.id))}
                    onAccept={() =>
                      profile.pendingRequestId &&
                      act(() => acceptFriendRequest(profile.pendingRequestId!))
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FriendAction({
  profile,
  busy,
  onAdd,
  onAccept,
}: {
  profile: GetProfileResponseType;
  busy: boolean;
  onAdd: () => void;
  onAccept: () => void;
}) {
  switch (profile.friendshipStatus) {
    case "friends":
      return (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 py-2.5 text-sm font-medium text-green-700">
          <Check className="size-4" />
          You're friends
        </div>
      );
    case "request_sent":
      return (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-500">
          <Clock className="size-4" />
          Friend request sent
        </div>
      );
    case "request_received":
      return (
        <Button
          value="Accept friend request"
          loading={busy}
          onClick={onAccept}
        />
      );
    default:
      return (
        <Button
          value="Add friend"
          loading={busy}
          onClick={onAdd}
          icon={<UserPlus className="size-4" />}
        />
      );
  }
}
