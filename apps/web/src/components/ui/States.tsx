import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Loading indicator: three dots that talk over each other, like a chat.
 * Respects `prefers-reduced-motion` (the dots just sit still).
 */
export function LoadingState({ text }: { text?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex items-end gap-1.5" aria-hidden>
        <Dot className="[animation-delay:-0.32s]" />
        <Dot className="[animation-delay:-0.16s]" />
        <Dot />
      </div>
      <span className="text-sm text-slate-500">{text ?? "Loading"}</span>
    </div>
  );
}

function Dot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full bg-violet-400 motion-safe:animate-bounce",
        className,
      )}
    />
  );
}

/**
 * Empty state: a short line, optionally an icon above it and an action below.
 * An empty screen is an invitation to do something, not just an apology.
 */
export function EmptyState({
  text,
  icon,
  action,
}: {
  text: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-500 dark:bg-violet-500/15">
          {icon}
        </div>
      )}
      <p className="max-w-xs text-sm text-slate-500">{text}</p>
      {action}
    </div>
  );
}
