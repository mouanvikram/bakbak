import { useEffect, useState } from "react";
import { getSettings, updateNotifications } from "@/features/settings/api";
import type { NotificationSettingsType } from "@bakbak/contracts";
import { Button } from "@/components/ui/Button";
import { ToggleRow } from "@/components/ui/Toggle";

export function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettingsType>({
    messages: true,
    sounds: true,
    alerts: true,
    emailDigest: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSettings()
      .then((res) => setSettings(res.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateNotifications(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500">
          Manage how you receive messages, sounds, and alerts
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <ToggleRow
          label="Messages"
          description="Receive notifications for new messages"
          checked={settings.messages}
          disabled={saving}
          onChange={(v) => setSettings((s) => ({ ...s, messages: v }))}
        />
        <ToggleRow
          label="Sounds"
          description="Play sounds for incoming messages and calls"
          checked={settings.sounds}
          disabled={saving}
          onChange={(v) => setSettings((s) => ({ ...s, sounds: v }))}
        />
        <ToggleRow
          label="Alerts"
          description="Show desktop alerts for important events"
          checked={settings.alerts}
          disabled={saving}
          onChange={(v) => setSettings((s) => ({ ...s, alerts: v }))}
        />
        <ToggleRow
          label="Email Digest"
          description="Receive a daily email summary of activity"
          checked={settings.emailDigest}
          disabled={saving}
          onChange={(v) => setSettings((s) => ({ ...s, emailDigest: v }))}
        />
        <div className="flex items-center justify-end gap-3 pt-4">
          {saved && (
            <span className="text-sm text-green-600" role="status">
              Saved
            </span>
          )}
          <Button
            value="Save preferences"
            size="lg"
            fullWidth={false}
            loading={saving}
            loadingText="Saving…"
            onClick={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
