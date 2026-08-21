import { useState } from "react";

export function AppearancePage() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      // TODO: call update appearance API
      console.log({ theme, fontSize });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Appearance</h1>
        <p className="text-sm text-gray-500">
          Customize how BakBak looks for you
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900">Theme</span>
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition ${
                  theme === option
                    ? "border-[#805FF8] bg-violet-50 text-[#805FF8]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900">Font Size</span>
          <div className="flex gap-3">
            {(["small", "medium", "large"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFontSize(option)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition ${
                  fontSize === option
                    ? "border-[#805FF8] bg-violet-50 text-[#805FF8]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

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
