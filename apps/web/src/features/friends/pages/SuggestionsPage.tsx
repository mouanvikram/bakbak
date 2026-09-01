import { useEffect, useState } from "react";
import type { SearchUserType } from "@bakbak/contracts";
import { getPendingRequests, getSuggestions, sendFriendRequest } from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { Spinner } from "@/components/ui/Spinner";

export function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SearchUserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const res = await getSuggestions();
      setSuggestions(res.suggestions);
      const pr = await getPendingRequests();
      const ids = new Set<string>([
        ...pr.sent.map((r) => r.receiver.id),
        ...pr.received.map((r) => r.sender.id),
      ]);
      setPendingIds(ids);
    } catch {
      setStatus("Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd(userId: string) {
    setBusyId(userId);
    setStatus("");
    try {
      await sendFriendRequest(userId);
      setPendingIds((prev) => new Set(prev).add(userId));
      setStatus("Friend request sent");
    } catch {
      setStatus("Failed to send request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Suggestions</h1>
        <p className="text-sm text-gray-500">People you might want to connect with</p>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      {loading ? (
        <LoadingState />
      ) : suggestions.length === 0 ? (
        <EmptyState text="No suggestions right now" />
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              actions={
                pendingIds.has(u.id) ? (
                  <span className="text-xs font-semibold text-gray-400">Pending</span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => handleAdd(u.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === u.id && <Spinner className="size-3.5" />}
                    Add Friend
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}