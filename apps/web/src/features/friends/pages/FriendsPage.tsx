import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { FriendshipResponseType } from "@bakbak/contracts";
import { getFriends, removeFriend } from "@/features/friends/api";
import { createDirectChat } from "@/features/chat/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";

export function FriendsPage() {
  const [friends, setFriends] = useState<FriendshipResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
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
    try {
      await removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f.friend.id !== friendId));
      setStatus("Friend removed");
    } catch {
      setStatus("Failed to remove friend");
    }
  }

  async function handleMessage(friendId: string) {
    try {
      const chat = await createDirectChat({ type: "DIRECT", participantId: friendId });
      navigate(`/chats/${chat.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to open chat");
    }
  }

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
                    onClick={() => handleMessage(f.friend.id)}
                    className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(f.friend.id)}
                    className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
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