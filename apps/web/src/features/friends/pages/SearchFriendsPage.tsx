import { useState } from "react";
import type { SearchUserType } from "@bakbak/contracts";
import { useAuth } from "@/features/auth/auth-context";
import { searchUsers } from "@/features/users/api";
import { getPendingRequests, sendFriendRequest } from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export function SearchFriendsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await searchUsers(query.trim());
      setResults(res.users);
      const pr = await getPendingRequests();
      const ids = new Set<string>([
        ...pr.sent.map((r) => r.receiver.id),
        ...pr.received.map((r) => r.sender.id),
      ]);
      setPendingIds(ids);
    } catch {
      setStatus("Search failed");
    } finally {
      setLoading(false);
    }
  }

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

  const filtered = results.filter((u) => u.id !== user?.id);

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Search People</h1>
        <p className="text-sm text-gray-500">Find people by name or username</p>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or username"
          aria-label="Search people"
          className="focus:border-brand-500 focus:ring-brand-500/15 h-12 flex-1 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 transition outline-none focus:ring-2"
        />
        <Button
          value="Search"
          type="submit"
          size="lg"
          fullWidth={false}
          loading={loading}
          loadingText="Searching…"
          disabled={loading || !query.trim()}
        />
      </form>
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 && query ? (
        <EmptyState text="No users found" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((u) => (
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
