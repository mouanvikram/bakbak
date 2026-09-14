import { createContext, useContext } from "react";

export interface NotificationPrefs {
  messages: boolean;
  sounds: boolean;
}

/**
 * State of this browser's push subscription. Only relevant while Messages is
 * on and the user is signed in; at all other times it reads "idle".
 */
export type PushDeviceStatus =
  | "unsupported" // browser/context can't do web push
  | "unconfigured" // server has no VAPID keys yet
  | "idle" // messages off, or signed out — deliberately not subscribed
  | "prompt" // permission not asked yet; the user has to click to allow
  | "denied" // notification permission was refused
  | "subscribed" // pushing to this browser for this account
  | "error"; // something transient failed; retry is safe

export interface NotificationsContextValue {
  prefs: NotificationPrefs;
  setPrefs: (next: Partial<NotificationPrefs>) => void;
  /**
   * Ask for notification permission (if not yet answered) and subscribe this
   * browser. Must be called directly from a click handler — browsers only
   * show the permission prompt in response to a user gesture.
   */
  retrySubscribe: () => void;
  isSubscribing: boolean;
  deviceStatus: PushDeviceStatus;
}

export const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }
  return ctx;
}