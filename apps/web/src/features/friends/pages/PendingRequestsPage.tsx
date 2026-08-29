import { useEffect, useState } from "react";
import type { FriendRequestResponseType } from "@bakbak/contracts";
import { acceptFriendRequest, getPendingRequests, rejectFriendRequest } from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";

export function PendingRequestsPage() {
  const [requests, setRequests] = useState<FriendRequestResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    setStatus("");
    try {
      const res = await getPendingRequests();
      setRequests(res.received);
    } catch {
      setStatus("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAccept(requestId: string) {
    try {
      await acceptFriendRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setStatus("Request accepted");
    } catch {
      setStatus("Failed to accept request");
    }
  }

  async function handleReject(requestId: string) {
    try {
      await rejectFriendRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setStatus("Request rejected");
    } catch {
      setStatus("Failed to reject request");
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Pending Requests</h1>
        <p className="text-sm text-gray-500">Friend requests waiting for you</p>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      {loading ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState text="No pending requests" />
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <UserCard
              key={r.id}
              user={r.sender}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => handleAccept(r.id)}
                    className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(r.id)}
                    className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Reject
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