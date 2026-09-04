import { useChatPreferences } from "@/features/settings/chat-preferences-context";
import { ToggleRow } from "@/components/ui/Toggle";

export function ChatSettingsPage() {
  const { preferences, setPreferences } = useChatPreferences();

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Chat Settings</h1>
        <p className="text-sm text-gray-500">
          Control how the composer behaves and how media appears
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <ToggleRow
          label="Enter to send"
          description="Press Enter to send, Shift+Enter for a new line. When off, use Ctrl+Enter (⌘+Enter on Mac) to send."
          checked={preferences.enterToSend}
          onChange={(v) => setPreferences({ enterToSend: v })}
        />
        <ToggleRow
          label="Media preview"
          description="Show images and videos inline in the conversation. When off, they appear as download links."
          checked={preferences.mediaPreview}
          onChange={(v) => setPreferences({ mediaPreview: v })}
        />
      </div>
    </div>
  );
}
