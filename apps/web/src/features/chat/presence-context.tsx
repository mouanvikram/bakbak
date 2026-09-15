import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSocket } from "@/features/chat/socket-context";

/**
 * App-wide presence — the single client-side source for who is online and
 * when they were last seen. The server auto-joins every socket to all of the
 * user's chat rooms on connect and emits `presence:state` (a snapshot per
 * room) plus `presence` (deltas, carrying `lastSeenAt` on the way offline), so
 * one listener here serves the sidebar, the open chat, and anything else.
 */
interface PresenceValue {
  onlineUserIds: ReadonlySet<string>;
  isOnline: (userId: string | null | undefined) => boolean;
  /**
   * When the user was last seen: the newer of what live `presence` events
   * reported and `fallback` — typically the `lastSeenAt` loaded with the data
   * on screen, which can itself be fresher than an event from earlier.
   */
  lastSeenAt: (
    userId: string | null | undefined,
    fallback?: string | null,
  ) => string | undefined;
}

const PresenceContext = createContext<PresenceValue | null>(null);

/** The later of two ISO timestamps; either may be missing. */
function latestIso(
  a: string | null | undefined,
  b: string | null | undefined,
): string | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [online, setOnline] = useState<Set<string>>(() => new Set());
  // userId -> ISO time they went offline, from live `presence` events. Kept
  // across disconnects: a last-seen time doesn't go stale the way "online" does.
  const [lastSeen, setLastSeen] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!socket) {
      setOnline(new Set());
      return;
    }
    const s = socket;

    const onState = (data: { chatId: string; online: string[] }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        for (const id of data.online) next.add(id);
        return next;
      });
    };

    const onDelta = (data: {
      userId: string;
      online: boolean;
      lastSeenAt?: string;
    }) => {
      setOnline((prev) => {
        if (prev.has(data.userId) === data.online) return prev;
        const next = new Set(prev);
        if (data.online) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
      if (!data.online && data.lastSeenAt) {
        const at = data.lastSeenAt;
        setLastSeen((prev) => {
          if (latestIso(prev.get(data.userId), at) !== at) return prev;
          return new Map(prev).set(data.userId, at);
        });
      }
    };

    // A dropped connection makes every "online" flag stale; the fresh
    // `presence:state` volley on reconnect rebuilds the set.
    const onDisconnect = () => setOnline(new Set());

    s.on("presence:state", onState);
    s.on("presence", onDelta);
    s.on("disconnect", onDisconnect);

    return () => {
      s.off("presence:state", onState);
      s.off("presence", onDelta);
      s.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const value = useMemo<PresenceValue>(
    () => ({
      onlineUserIds: online,
      isOnline: (userId) => (userId ? online.has(userId) : false),
      lastSeenAt: (userId, fallback) =>
        latestIso(userId ? lastSeen.get(userId) : undefined, fallback),
    }),
    [online, lastSeen],
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return ctx;
}
