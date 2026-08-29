import { useEffect, useState } from "react";
import type { FriendRequestResponseType } from "@bakbak/contracts";
import { cancelFriendRequest, getPendingRequests } from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";

export function SentRequestsPage() {
  const [requests, setRequests] = useState<FriendRequestResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const res = await getPendingRequests();
      setRequests(res.sent);
    } catch {
      setStatus("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCancel(requestId: string) {
    try {
      await cancelFriendRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setStatus("Request cancelled");
    } catch {
      setStatus("Failed to cancel request");
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Sent Requests</h1>
        <p className="text-sm text-gray-500">Friend requests you've sent</p>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      {loading ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState text="No sent requests" />
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <UserCard
              key={r.id}
              user={r.receiver}
              actions={
                <button
                  type="button"
                  onClick={() => handleCancel(r.id)}
                  className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}