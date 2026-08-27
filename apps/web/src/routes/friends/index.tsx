import { useAuth } from "@/context/AuthContext";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriends,
  getPendingRequests,
  getSuggestions,
  removeFriend,
  rejectFriendRequest,
  sendFriendRequest,
} from "@/api/friend.api";
import { createDirectChat } from "@/api/chat.api";
import { useNavigate } from "react-router";
import { searchUsers } from "@/api/user.api";
import type { FriendRequestResponseType, FriendshipResponseType, SearchUserType } from "@bakbak/contracts";
import { useEffect, useState } from "react";

function getInitials(name: string) {
  return name.charAt(0).toUpperCase();
}

function displayName(user: { username: string; profile?: SearchUserType["profile"] }) {
  const name = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || user.profile?.displayName;
  return name || user.username;
}

function UserAvatar({ user }: { user: { username: string; profile?: SearchUserType["profile"] } }) {
  const name = displayName(user);
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-600">
      {getInitials(name)}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
      Loading...
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

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

  useEffect(() => { load(); }, []);

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
      {loading ? <Loading /> : friends.length === 0 ? <Empty text="No friends yet" /> : (
        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <div key={f.friendshipId} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar user={f.friend} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{displayName(f.friend)}</div>
                  <div className="text-xs text-gray-500">@{f.friend.username}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleMessage(f.friend.id)} className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm">Message</button>
                <button onClick={() => handleRemove(f.friend.id)} className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <button type="submit" disabled={loading || !query.trim()} className="cursor-pointer rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-6 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
          Search
        </button>
      </form>
      {loading ? <Loading /> : filtered.length === 0 && query ? <Empty text="No users found" /> : (
        <div className="flex flex-col gap-2">
          {filtered.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar user={u} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{displayName(u)}</div>
                  <div className="text-xs text-gray-500">@{u.username}</div>
                </div>
              </div>
              {pendingIds.has(u.id) ? (
                <span className="text-xs font-semibold text-gray-400">Pending</span>
              ) : (
                <button onClick={() => handleAdd(u.id)} className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm">Add Friend</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => { load(); }, []);

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
      {loading ? <Loading /> : requests.length === 0 ? <Empty text="No pending requests" /> : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar user={r.sender} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{displayName(r.sender)}</div>
                  <div className="text-xs text-gray-500">@{r.sender.username}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAccept(r.id)} className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm">Accept</button>
                <button onClick={() => handleReject(r.id)} className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => { load(); }, []);

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
      {loading ? <Loading /> : requests.length === 0 ? <Empty text="No sent requests" /> : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar user={r.receiver} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{displayName(r.receiver)}</div>
                  <div className="text-xs text-gray-500">@{r.receiver.username}</div>
                </div>
              </div>
              <button onClick={() => handleCancel(r.id)} className="cursor-pointer rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SearchUserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

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

  useEffect(() => { load(); }, []);

  async function handleAdd(userId: string) {
    try {
      await sendFriendRequest(userId);
      setPendingIds((prev) => new Set(prev).add(userId));
      setStatus("Friend request sent");
    } catch {
      setStatus("Failed to send request");
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Suggestions</h1>
        <p className="text-sm text-gray-500">People you might want to connect with</p>
      </div>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      {loading ? <Loading /> : suggestions.length === 0 ? <Empty text="No suggestions right now" /> : (
        <div className="flex flex-col gap-2">
          {suggestions.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar user={u} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{displayName(u)}</div>
                  <div className="text-xs text-gray-500">@{u.username}</div>
                </div>
              </div>
              {pendingIds.has(u.id) ? (
                <span className="text-xs font-semibold text-gray-400">Pending</span>
              ) : (
                <button onClick={() => handleAdd(u.id)} className="cursor-pointer rounded-lg bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-4 py-1.5 text-xs font-bold text-white shadow-sm">Add Friend</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
