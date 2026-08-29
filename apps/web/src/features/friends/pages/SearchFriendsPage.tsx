import { useState } from "react";
import type { SearchUserType } from "@bakbak/contracts";
import { useAuth } from "@/features/auth/auth-context";
import { searchUsers } from "@/features/users/api";
import { getPendingRequests, sendFriendRequest } from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";

export function SearchFriendsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const { user } = useAuth();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

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
    try {
      await sendFriendRequest(userId);
      setPendingIds((prev) => new Set(prev).add(userId));
      setStatus("Friend request sent");
    } catch {
      setStatus("Failed to send request");
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
          placeholder="Search..."
          className="h-12 flex-1 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition focus:border-[#805FF8] focus:ring-2 focus:ring-[#805FF8]/10"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="cursor-pointer rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-6 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Search
        </button>
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
                  <span className="text-xs font-semibold text-gray-400">Pending</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdd(u.id)}
                    className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                  >
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