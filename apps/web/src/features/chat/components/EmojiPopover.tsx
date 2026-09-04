import { Suspense, lazy, useEffect, useRef } from "react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "@/features/settings/theme-context";
import { Spinner } from "@/components/ui/Spinner";

// The picker (emoji data + component) is a chunky dependency — only pull it in
// when someone actually opens the emoji keyboard.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

/**
 * A searchable emoji keyboard anchored above the composer. Closes on Escape or
 * a click outside.
 */
export function EmojiPopover({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(
      () => window.addEventListener("mousedown", onClick),
      0,
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      clearTimeout(t);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
    >
      <Suspense
        fallback={
          <div
            style={{ width: 320, height: 380 }}
            className="flex items-center justify-center"
          >
            <Spinner className="size-5" />
          </div>
        }
      >
        <EmojiPicker
          onEmojiClick={(data: EmojiClickData) => onPick(data.emoji)}
          theme={(resolvedTheme === "dark" ? "dark" : "light") as Theme}
          lazyLoadEmojis
          skinTonesDisabled
          width={320}
          height={380}
          previewConfig={{ showPreview: false }}
        />
      </Suspense>
    </div>
  );
}
