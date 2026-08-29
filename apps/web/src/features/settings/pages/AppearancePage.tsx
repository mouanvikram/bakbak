import { useEffect, useState } from "react";
import { getSettings, updateAppearance } from "@/features/settings/api";
import type { AppearanceSettingsType } from "@bakbak/contracts";

export function AppearancePage() {
  const [settings, setSettings] = useState<AppearanceSettingsType>({
    theme: "system",
    fontSize: "medium",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSettings()
      .then((res) => setSettings(res.appearance))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateAppearance(settings);
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
        <h1 className="text-2xl font-semibold text-gray-900">Appearance</h1>
        <p className="text-sm text-gray-500">Customize how BakBak looks for you</p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900">Theme</span>
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((option) => (
              <button key={option} type="button" onClick={() => setSettings((s) => ({ ...s, theme: option }))} className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition ${settings.theme === option ? "border-[#805FF8] bg-violet-50 text-[#805FF8]" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}>{option}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900">Font Size</span>
          <div className="flex gap-3">
            {(["small", "medium", "large"] as const).map((option) => (
              <button key={option} type="button" onClick={() => setSettings((s) => ({ ...s, fontSize: option }))} className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition ${settings.fontSize === option ? "border-[#805FF8] bg-violet-50 text-[#805FF8]" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}>{option}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4">
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          <button type="button" onClick={handleSave} disabled={saving} className="cursor-pointer rounded-xl bg-linear-to-br from-[#805FF8] to-[#4C18EF] px-6 py-3 font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] transition-all active:translate-y-px active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
