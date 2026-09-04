import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  /** Viewport coordinates of the originating right-click. */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * A small menu anchored at a cursor position — the branded replacement for the
 * browser's native right-click menu. Closes on Escape, scroll, resize, or a
 * click anywhere outside it.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu fully on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.min(x, window.innerWidth - width - pad),
      top: Math.min(y, window.innerHeight - height - pad),
    });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="menu"
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
        className="fixed min-w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg motion-safe:animate-[pop-in_120ms_var(--ease-emphasized)]"
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors disabled:opacity-40",
              item.destructive
                ? "text-red-600 hover:bg-red-50"
                : "text-slate-700 hover:bg-slate-50",
            )}
          >
            {item.icon && (
              <span className="shrink-0 [&>svg]:size-4">{item.icon}</span>
            )}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
