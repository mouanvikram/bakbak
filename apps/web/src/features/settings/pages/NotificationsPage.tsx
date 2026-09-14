import { Button } from "@/components/ui/Button";
import { ToggleRow } from "@/components/ui/Toggle";
import { useNotifications } from "@/features/settings/notifications-context";
import { useAuth } from "@/features/auth/auth-context";

function deviceStatusText(
  status: string,
  isAuthenticated: boolean,
): string | null {
  if (!isAuthenticated) {
    return "Sign in to get browser notifications for messages.";
  }
  switch (status) {
    case "subscribed":
      return "On — you'll get browser notifications even when the app is closed.";
    case "prompt":
      return "Allow browser notifications to get messages while BakBak is closed.";
    case "denied":
      return "Blocked. Allow notifications for this site in your browser, then try again.";
    case "unsupported":
      return "Your browser doesn't support browser notifications.";
    case "unconfigured":
      return "Server-side push isn't configured yet, but in-app toasts still work.";
    case "idle":
      return "Browser notifications off for this browser.";
    case "error":
      return "Couldn't set up notifications right now — try again.";
    default:
      return null;
  }
}

export function NotificationsPage() {
  const { prefs, setPrefs, deviceStatus, isSubscribing, retrySubscribe } =
    useNotifications();
  const { isAuthenticated } = useAuth();
  const messagesOff = !prefs.messages;

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500">
          Manage how you receive messages and sounds
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <ToggleRow
          label="Messages"
          description="New messages notify you (in-app toasts and browser notifications, even when the app is closed)"
          checked={prefs.messages}
          onChange={(v) => setPrefs({ messages: v })}
        />

        {!messagesOff && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900/50">
            <p className="text-gray-600 dark:text-gray-300">
              {deviceStatusText(deviceStatus, isAuthenticated) ??
                "Browser notifications setup in progress…"}
            </p>
            {(deviceStatus === "prompt" ||
              deviceStatus === "denied" ||
              deviceStatus === "error" ||
              isSubscribing) && (
              <Button
                value={
                  isSubscribing
                    ? "Checking…"
                    : deviceStatus === "prompt"
                      ? "Allow notifications"
                      : "Try again"
                }
                size="md"
                fullWidth={false}
                loading={isSubscribing}
                onClick={retrySubscribe}
              />
            )}
          </div>
        )}

        <ToggleRow
          label="Sounds"
          description="Play sounds for new messages, typing, sending, and switches"
          checked={prefs.sounds}
          onChange={(v) => setPrefs({ sounds: v })}
        />
      </div>
    </div>
  );
}