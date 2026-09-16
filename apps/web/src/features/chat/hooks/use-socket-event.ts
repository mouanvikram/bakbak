import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

/**
 * Subscribes to a single socket event for as long as the component is mounted.
 *
 * The handler is read through a ref, so it can close over fresh props and state
 * without tearing the listener down on every render: the subscription only
 * changes when the socket or the event name does.
 */
export function useSocketEvent<T>(
  socket: Socket | undefined,
  event: string,
  handler: (payload: T) => void,
) {
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => latest.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
