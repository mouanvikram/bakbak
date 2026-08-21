import { useState } from "react";

export function NotificationsPage() {
  const [messages, setMessages] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      // TODO: call update notifications API
      console.log({ messages, sounds, alerts, emailDigest });
    } finally {
      setLoading(false);
    }
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
          checked={messages}
          onChange={setMessages}
        />
        <ToggleRow
          label="Sounds"
          description="Play sounds for incoming messages and calls"
          checked={sounds}
          onChange={setSounds}
        />
        <ToggleRow
          label="Alerts"
          description="Show desktop alerts for important events"
          checked={alerts}
          onChange={setAlerts}
        />
        <ToggleRow
          label="Email Digest"
          description="Receive a daily email summary of activity"
          checked={emailDigest}
          onChange={setEmailDigest}
        />

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="cursor-pointer rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-6 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <div>
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? "bg-[#805FF8]" : "bg-gray-200"}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}
