import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { FriendshipResponseType } from "@bakbak/contracts";
import { getFriends, removeFriend } from "@/features/friends/api";
import { createDirectChat } from "@/features/chat/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { Spinner } from "@/components/ui/Spinner";

export function FriendsPage() {
  const [friends, setFriends] = useState<FriendshipResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<
    { id: string; action: "message" | "remove" } | null
  >(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const res = await getFriends();
      setFriends(res.friendships);
    } catch {
      setStatus("Failed to load friends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRemove(friendId: string) {
    if (!confirm("Remove this friend?")) return;
    setBusy({ id: friendId, action: "remove" });
    setStatus("");
    try {
      await removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f.friend.id !== friendId));
      setStatus("Friend removed");
    } catch {
      setStatus("Failed to remove friend");
    } finally {
      setBusy(null);
    }
  }

  async function handleMessage(friendId: string) {
    setBusy({ id: friendId, action: "message" });
    setStatus("");
    try {
      const chat = await createDirectChat({ type: "DIRECT", participantId: friendId });
      navigate(`/chats/${chat.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to open chat");
    } finally {
      setBusy(null);
    }
  }

  const isLoading = (id: string, action: "message" | "remove") =>
    busy?.id === id && busy.action === action;

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Friends</h1>
        <p className="text-sm text-gray-500">People you're connected with</p>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      {loading ? (
        <LoadingState />
      ) : friends.length === 0 ? (
        <EmptyState text="No friends yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <UserCard
              key={f.friendshipId}
              user={f.friend}
              actions={
                <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => handleMessage(f.friend.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading(f.friend.id, "message") && (
                      <Spinner className="size-3.5" />
                    )}
                    Message
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => handleRemove(f.friend.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading(f.friend.id, "remove") && (
                      <Spinner className="size-3.5" />
                    )}
                    Remove
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}