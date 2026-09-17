import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getSettings, updateNotifications } from "@/features/settings/api";
import {
  ensureNotificationPermission,
  removePushSubscription,
  setupPushSubscription,
  type PushSetupStatus,
} from "@/lib/push";
import { setSoundsEnabled } from "@/lib/sounds";
import { reportError } from "@/lib/report";
import { STORAGE_KEYS, readJson, writeJson } from "@/lib/storage";
import {
  NotificationsContext,
  type NotificationPrefs,
  type PushDeviceStatus,
} from "./notifications-context";

const DEFAULTS: NotificationPrefs = {
  messages: true,
  sounds: true,
};

const DEVICE_STATUS: Record<PushSetupStatus, PushDeviceStatus> = {
  ok: "subscribed",
  unsupported: "unsupported",
  unconfigured: "unconfigured",
  prompt: "prompt",
  denied: "denied",
  error: "error",
};

/**
 * Notification preferences, mirroring ThemeProvider/ChatPreferencesProvider:
 * localStorage for an instant value, reconciled with the API once signed in.
 *
 * Also owns the web-push subscription for this browser: Messages ON + signed
 * in means the browser is subscribed (so messages arrive even with the app
 * closed) and Messages OFF (or signing out) tears it down. Sounds syncs with
 * the API as the ChatPreferencesProvider does.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [prefs, setState] = useState<NotificationPrefs>(() =>
    readJson(STORAGE_KEYS.notifications, DEFAULTS),
  );
  const [deviceStatus, setDeviceStatus] =
    useState<PushDeviceStatus>("idle");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Subscribe/unsubscribe both touch the one browser subscription. Run them
  // strictly one after another: interleaved, an unsubscribe can destroy the
  // subscription a concurrent subscribe just registered with the API, leaving
  // the server pushing to a dead endpoint.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => {});
    return run;
  }, []);

  // Whether this tab has seen a signed-in session, so a sign-out can be told
  // apart from the page-load moment before auth has resolved.
  const wasAuthenticated = useRef(false);

  // Reconcile with the server once signed in.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getSettings()
      .then((res) => {
        if (cancelled) return;
        const synced: NotificationPrefs = {
          messages: res.notifications.messages,
          sounds: res.notifications.sounds,
        };
        setState(synced);
        writeJson(STORAGE_KEYS.notifications, synced);
        setSoundsEnabled(synced.sounds);
      })
      .catch((err: unknown) => reportError("settings:load", err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Keep the browser side in sync with (Messages ON && signed in).
  useEffect(() => {
    // Until auth resolves, "not signed in" just means "don't know yet".
    // Acting on it would unsubscribe this browser on every page load.
    if (authLoading) return;

    let cancelled = false;

    if (!isAuthenticated || !prefs.messages) {
      setDeviceStatus("idle");
      setIsSubscribing(false);
      // Tear down only on a real sign-out or Messages being turned off —
      // never for a visitor who simply isn't signed in on this load.
      if (wasAuthenticated.current || isAuthenticated) {
        void enqueue(removePushSubscription);
      }
      wasAuthenticated.current = isAuthenticated;
      return;
    }
    wasAuthenticated.current = true;

    setIsSubscribing(true);
    enqueue(setupPushSubscription)
      .then((result) => {
        if (!cancelled) setDeviceStatus(DEVICE_STATUS[result.status]);
      })
      .catch(() => {
        if (!cancelled) setDeviceStatus("error");
      })
      .finally(() => {
        if (!cancelled) setIsSubscribing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, prefs.messages, attempt, enqueue]);

  const setPrefs = useCallback(
    (next: Partial<NotificationPrefs>) => {
      setState((prev) => {
        const merged = { ...prev, ...next };
        writeJson(STORAGE_KEYS.notifications, merged);
        setSoundsEnabled(merged.sounds);
        if (isAuthenticated) {
          void updateNotifications({
            messages: merged.messages,
            sounds: merged.sounds,
          }).catch((err: unknown) =>
            reportError("settings:notifications:save", err),
          );
        }
        return merged;
      });
    },
    [isAuthenticated],
  );

  const retrySubscribe = useCallback(() => {
    // Notification.requestPermission() runs synchronously inside this click
    // (before the first await), which is what lets the browser show the prompt.
    void ensureNotificationPermission().finally(() => setAttempt((n) => n + 1));
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        prefs,
        setPrefs,
        retrySubscribe,
        isSubscribing,
        deviceStatus,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
