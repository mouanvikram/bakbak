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
 * App-wide presence. The server auto-joins every socket to all of the user's
 * chat rooms on connect and emits `presence:state` (a snapshot per room) plus
 * `presence` (deltas), so a single listener here covers every conversation in
 * the sidebar and the open chat alike.
 */
interface PresenceValue {
  onlineUserIds: ReadonlySet<string>;
  isOnline: (userId: string | null | undefined) => boolean;
}

const PresenceContext = createContext<PresenceValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [online, setOnline] = useState<Set<string>>(() => new Set());

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

    const onDelta = (data: { userId: string; online: boolean }) => {
      setOnline((prev) => {
        if (prev.has(data.userId) === data.online) return prev;
        const next = new Set(prev);
        if (data.online) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
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
    }),
    [online],
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
