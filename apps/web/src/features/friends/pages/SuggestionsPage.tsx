import { useEffect, useState } from "react";
import type { SearchUserType } from "@bakbak/contracts";
import {
  getPendingRequests,
  getSuggestions,
  sendFriendRequest,
} from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

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
        <p className="text-sm text-gray-500">
          People you might want to connect with
        </p>
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
                  <span className="text-xs font-semibold text-gray-400">
                    Pending
                  </span>
                ) : (
                  <Button
                    value="Add friend"
                    size="sm"
                    fullWidth={false}
                    disabled={busyId !== null}
                    loading={busyId === u.id}
                    onClick={() => handleAdd(u.id)}
                  />
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
