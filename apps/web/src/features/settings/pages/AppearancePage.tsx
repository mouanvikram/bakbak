import { Check } from "lucide-react";
import { useTheme } from "@/features/settings/theme-context";

const THEME_OPTIONS = ["light", "dark", "system"] as const;
const FONT_SIZES = ["small", "medium", "large"] as const;

export function AppearancePage() {
  const { theme, fontSize, setTheme, setFontSize } = useTheme();

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Appearance</h1>
        <p className="text-sm text-gray-500">
          Customize how BakBak looks for you. Changes apply instantly.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900">Theme</span>
          <div className="flex gap-3">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 border px-4 py-3 text-sm font-semibold capitalize transition ${
                  theme === option
                    ? "border-[#805FF8] bg-violet-50 text-[#805FF8]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {theme === option && <Check className="size-4" />}
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900">Font Size</span>
          <div className="flex gap-3">
            {FONT_SIZES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFontSize(option)}
                className={`flex-1 cursor-pointer border px-4 py-3 text-sm font-semibold capitalize transition ${
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
      </div>
    </div>
  );
}
