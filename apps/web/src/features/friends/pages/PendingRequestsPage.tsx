import { useEffect, useState } from "react";
import type { FriendRequestResponseType } from "@bakbak/contracts";
import {
  acceptFriendRequest,
  getPendingRequests,
  rejectFriendRequest,
} from "@/features/friends/api";
import { UserCard } from "@/features/friends/components/UserCard";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export function PendingRequestsPage() {
  const [requests, setRequests] = useState<FriendRequestResponseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<{
    id: string;
    action: "accept" | "reject";
  } | null>(null);

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
    setBusy({ id: requestId, action: "accept" });
    setStatus("");
    try {
      await acceptFriendRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setStatus("Request accepted");
    } catch {
      setStatus("Failed to accept request");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(requestId: string) {
    setBusy({ id: requestId, action: "reject" });
    setStatus("");
    try {
      await rejectFriendRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setStatus("Request rejected");
    } catch {
      setStatus("Failed to reject request");
    } finally {
      setBusy(null);
    }
  }

  const isLoading = (id: string, action: "accept" | "reject") =>
    busy?.id === id && busy.action === action;

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Pending Requests
        </h1>
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
                  <Button
                    value="Accept"
                    size="sm"
                    fullWidth={false}
                    disabled={busy !== null}
                    loading={isLoading(r.id, "accept")}
                    onClick={() => handleAccept(r.id)}
                  />
                  <Button
                    value="Reject"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    disabled={busy !== null}
                    loading={isLoading(r.id, "reject")}
                    onClick={() => handleReject(r.id)}
                  />
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
