import { useEffect, useState } from "react";
import { getSettings, updateChatPreferences } from "@/features/settings/api";
import type { ChatPreferencesType } from "@bakbak/contracts";
import { Button } from "@/components/ui/Button";
import { ToggleRow } from "@/components/ui/Toggle";

export function ChatSettingsPage() {
  const [settings, setSettings] = useState<ChatPreferencesType>({
    enterToSend: true,
    mediaPreview: true,
    chatHistory: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSettings()
      .then((res) => setSettings(res.chat))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateChatPreferences(settings);
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
        <h1 className="text-2xl font-semibold text-gray-900">Chat Settings</h1>
        <p className="text-sm text-gray-500">Manage behavior, media, and history preferences</p>
      </div>
      <div className="flex flex-col gap-4">
        <ToggleRow label="Enter to Send" description="Press Enter to send messages, Shift+Enter for new line" checked={settings.enterToSend} disabled={saving} onChange={(v) => setSettings((s) => ({ ...s, enterToSend: v }))} />
        <ToggleRow label="Media Preview" description="Automatically preview images and videos in chat" checked={settings.mediaPreview} disabled={saving} onChange={(v) => setSettings((s) => ({ ...s, mediaPreview: v }))} />
        <ToggleRow label="Chat History" description="Keep chat history available across sessions" checked={settings.chatHistory} disabled={saving} onChange={(v) => setSettings((s) => ({ ...s, chatHistory: v }))} />
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
