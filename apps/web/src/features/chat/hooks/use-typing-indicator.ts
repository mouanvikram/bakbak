import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useSocketEvent } from "./use-socket-event";

export interface TypingUser {
  userId: string;
  username: string;
}

interface TypingEvent {
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

/** Safety net: drop an indicator this long after the last "typing" event, in
 *  case the matching "stopped typing" one never arrives. */
const TYPING_TTL_MS = 6_000;

const NONE: TypingUser[] = [];

/**
 * Who is currently typing in `chatId`, from the room's `typing` events.
 *
 * The chat id is stored alongside the list so switching chats drops the
 * previous room's indicators without a reset effect.
 */
export function useTypingIndicator(
  socket: Socket | undefined,
  chatId: string | undefined,
  currentUserId: string | undefined,
): TypingUser[] {
  const [state, setState] = useState<{
    chatId?: string;
    users: TypingUser[];
  }>({ users: NONE });
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearUser = useCallback((userId: string) => {
    const pending = timers.current.get(userId);
    if (pending) {
      clearTimeout(pending);
      timers.current.delete(userId);
    }
    setState((prev) =>
      prev.users.some((u) => u.userId === userId)
        ? { ...prev, users: prev.users.filter((u) => u.userId !== userId) }
        : prev,
    );
  }, []);

  useSocketEvent<TypingEvent>(socket, "typing", (data) => {
    if (!chatId || data.chatId !== chatId) return;
    if (data.userId === currentUserId) return;
    if (!data.isTyping) {
      clearUser(data.userId);
      return;
    }

    setState((prev) => {
      const users = prev.chatId === chatId ? prev.users : NONE;
      if (users.some((u) => u.userId === data.userId)) {
        return prev.chatId === chatId ? prev : { chatId, users };
      }
      return {
        chatId,
        users: [...users, { userId: data.userId, username: data.username }],
      };
    });

    // Timer bookkeeping stays outside the updater — updaters run twice under
    // StrictMode, and a second pass must not cancel the timer it just set.
    const existing = timers.current.get(data.userId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      data.userId,
      setTimeout(() => clearUser(data.userId), TYPING_TTL_MS),
    );
  });

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [chatId]);

  return state.chatId === chatId ? state.users : NONE;
}

/**
 * Keeps this socket in the chat's room.
 *
 * Auto-join at connect time covers the chats that existed then, so re-emit for
 * a chat opened later — or created after this socket connected.
 */
export function useChatRoom(
  socket: Socket | undefined,
  chatId: string | undefined,
) {
  useSocketEvent(socket, "connect", () => {
    if (chatId) socket?.emit("chat:join", chatId);
  });

  useEffect(() => {
    if (!socket || !chatId) return;
    if (socket.connected) socket.emit("chat:join", chatId);
    return () => {
      // Tell the room we've stopped typing when navigating away.
      if (socket.connected) {
        socket.emit("typing", { chatId, isTyping: false });
      }
    };
  }, [socket, chatId]);
}
