/**
 * Web push (browser notifications) helpers. Used by the NotificationsProvider
 * to keep the device subscription in sync with Settings → Notifications →
 * Messages:
 *
 *   - on (and signed in): request permission, (re)register a push subscription
 *     with the browser, and record it server-side;
 *   - off (or signed out): forget the server-side row and tear the
 *     subscription down. The browser permission grant itself stays, so turning
 *     the toggle back on doesn't re-prompt.
 *
 * The Messages server-side flag (UserSettings.notifyMessages) decides who the
 * API pushes to; this file only manages *this browser's* subscription.
 */
import { apiClient } from "@/lib/api/client";
import type { PushConfigResponseType } from "@bakbak/contracts";

const SW_PATH = "/sw.js";

export type PushSetupStatus =
  | "ok"
  | "unsupported"
  | "unconfigured"
  | "prompt" // permission not asked yet; needs a click to ask
  | "denied"
  | "error";

export interface PushSetupResult {
  status: PushSetupStatus;
}

function browserSupportsPush(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(existing: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  return a.length === expected.length && a.every((byte, i) => byte === expected[i]);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const config = await apiClient<PushConfigResponseType>("/api/v1/push/config");
    return config.publicKey ?? null;
  } catch {
    return null;
  }
}

/** Register the service worker if needed and resolve when it's active. */
async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!browserSupportsPush()) return null;
  try {
    await navigator.serviceWorker.register(SW_PATH);
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Request (not reset) the browser's notification permission.
 *
 * Call this straight from a click handler: Firefox and Safari ignore or deny
 * permission requests that don't come from a user gesture, and Chrome demotes
 * them to a quiet prompt.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!browserSupportsPush()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function serializeSubscription(
  sub: PushSubscription,
): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const p256dh = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: p256dh ? bufferToBase64(p256dh) : "",
      auth: auth ? bufferToBase64(auth) : "",
    },
  };
}

/**
 * Make sure this browser is subscribed and known to the API. Returns a status
 * so callers can tell "all good" apart from "server lacks VAPID keys" or "the
 * user blocked notifications".
 */
export async function setupPushSubscription(): Promise<PushSetupResult> {
  if (!browserSupportsPush()) {
    return { status: "unsupported" };
  }

  // Never prompt from here — this runs from an effect, not a click. An
  // unanswered permission is reported so the UI can offer a button instead.
  if (Notification.permission === "denied") return { status: "denied" };
  if (Notification.permission !== "granted") return { status: "prompt" };

  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    return { status: "unconfigured" }; // server hasn't got VAPID configured
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { status: "unsupported" };
  }

  const serverKey = urlBase64ToUint8Array(publicKey);
  let sub = await registration.pushManager.getSubscription();

  // A subscription made under a different VAPID key (keys rotated, or a
  // different server) can never receive our pushes — replace it.
  if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
    sub = null;
  }

  if (!sub) {
    try {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKey,
      });
    } catch {
      // Permission is granted at this point, so a throw is a transient
      // push-service failure, not a refusal.
      return { status: "error" };
    }
  }

  const body = serializeSubscription(sub);
  if (!body.keys.p256dh || !body.keys.auth) {
    return { status: "error" };
  }

  try {
    await apiClient("/api/v1/push/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "error" };
  }
  return { status: "ok" };
}

/** Unsubscribe this browser and drop it from the API. Keeps the permission. */
export async function removePushSubscription(): Promise<void> {
  if (!browserSupportsPush()) return;
  const registration = await ensureServiceWorker();
  if (!registration) return;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;

  try {
    await apiClient("/api/v1/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify(serializeSubscription(sub)),
    });
  } catch {
    // The row may already be gone server-side; tearing down locally is what
    // actually stops the notifications.
  }
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}