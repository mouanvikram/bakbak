import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  MessageCircle,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createDirectChat,
  getErrorMessage,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
} from "../lib/api";
import { getDisplayName } from "../lib/utils";
import type { SearchUser } from "../types/api";
import { Avatar, Button, EmptyState, Input, Spinner } from "./ui";

export function FriendsPanel({
  currentUserId,
  onOpenChat,
}: {
  currentUserId?: string | null;
  onOpenChat: (chatId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const friendsQuery = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
  });

  const requestsQuery = useQuery({
    queryKey: ["friend-requests"],
    queryFn: getFriendRequests,
  });

  const invalidateSocial = () => {
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
    void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
  };

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const users = await searchUsers(q);
      setResults(users.filter((u) => u.id !== currentUserId));
    } catch (err) {
      setError(getErrorMessage(err, "Search failed"));
    } finally {
      setSearching(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: (userId: string) => sendFriendRequest(userId),
    onSuccess: () => {
      setInfo("Friend request sent");
      invalidateSocial();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptFriendRequest(id),
    onSuccess: () => invalidateSocial(),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectFriendRequest(id),
    onSuccess: () => invalidateSocial(),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFriendRequest(id),
    onSuccess: () => invalidateSocial(),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const chatMutation = useMutation({
    mutationFn: (userId: string) => createDirectChat(userId),
    onSuccess: (chat) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      onOpenChat(chat.id);
    },
    onError: (err) => setError(getErrorMessage(err, "Could not open chat")),
  });

  const friends = friendsQuery.data ?? [];
  const received = requestsQuery.data?.received ?? [];
  const sent = requestsQuery.data?.sent ?? [];

  return (
    <div className="scroll-thin h-full overflow-y-auto bg-surface p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
        <div>
          <h2 className="text-xl font-bold text-ink">Friends</h2>
          <p className="text-sm text-ink-muted">
            Find people, manage requests, and start chats
          </p>
        </div>

        {(error || info) && (
          <div
            className={
              error
                ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            }
          >
            {error || info}
          </div>
        )}

        {/* Search */}
        <section className="rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Find people</h3>
          <form onSubmit={onSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username or name"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? <Spinner /> : "Search"}
            </Button>
          </form>

          {results.length > 0 && (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
              {results.map((user) => {
                const name = getDisplayName(user);
                return (
                  <li
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Avatar name={name} src={user.profile?.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {name}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        @{user.username}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={() => chatMutation.mutate(user.id)}
                      disabled={chatMutation.isPending}
                      title="Message"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => addMutation.mutate(user.id)}
                      disabled={addMutation.isPending}
                      title="Add friend"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Incoming requests */}
        <section className="rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">
            Incoming requests
            {received.length > 0 && (
              <span className="ml-2 text-ink-muted">({received.length})</span>
            )}
          </h3>
          {requestsQuery.isLoading ? (
            <Spinner className="text-accent" />
          ) : received.length === 0 ? (
            <p className="text-sm text-ink-muted">No pending requests</p>
          ) : (
            <ul className="space-y-2">
              {received.map((req) => {
                const name = getDisplayName(req.sender);
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
                  >
                    <Avatar name={name} src={req.sender.profile?.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        @{req.sender.username}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => acceptMutation.mutate(req.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={() => rejectMutation.mutate(req.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Outgoing */}
        {sent.length > 0 && (
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Sent requests
            </h3>
            <ul className="space-y-2">
              {sent.map((req) => {
                const name = getDisplayName(req.receiver);
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
                  >
                    <Avatar name={name} src={req.receiver.profile?.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {name}
                      </p>
                      <p className="text-xs text-ink-muted">Pending</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => cancelMutation.mutate(req.id)}
                    >
                      Cancel
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Friends list */}
        <section className="rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">
            Your friends
            {friends.length > 0 && (
              <span className="ml-2 text-ink-muted">({friends.length})</span>
            )}
          </h3>
          {friendsQuery.isLoading ? (
            <Spinner className="text-accent" />
          ) : friends.length === 0 ? (
            <EmptyState
              title="No friends yet"
              description="Search for people and send a friend request to get started."
            />
          ) : (
            <ul className="space-y-2">
              {friends.map((entry) => {
                const friend = entry.friend;
                const name = getDisplayName(friend);
                return (
                  <li
                    key={entry.friendshipId}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
                  >
                    <Avatar name={name} src={friend.profile?.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        @{friend.username}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => chatMutation.mutate(friend.id)}
                      disabled={chatMutation.isPending}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
