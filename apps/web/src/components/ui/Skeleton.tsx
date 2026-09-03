import { cn } from "@/lib/utils";

/** A single shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gray-200/70 motion-safe:animate-pulse dark:bg-white/10",
        className,
      )}
    />
  );
}

/** Placeholder for the chat list while `listChats` is in flight. */
export function ChatListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              {/* Stagger the name widths so the column doesn't look printed. */}
              <Skeleton className={i % 2 === 0 ? "h-3.5 w-28" : "h-3.5 w-20"} />
              <Skeleton className="h-2.5 w-9 shrink-0" />
            </div>
            <Skeleton className={i % 3 === 0 ? "h-3 w-4/5" : "h-3 w-3/5"} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a conversation while messages load. */
export function MessageThreadSkeleton() {
  // Alternating incoming / outgoing bubbles of varied widths.
  const bubbles: Array<{ mine: boolean; w: string }> = [
    { mine: false, w: "w-40" },
    { mine: false, w: "w-56" },
    { mine: true, w: "w-32" },
    { mine: true, w: "w-48" },
    { mine: false, w: "w-52" },
    { mine: true, w: "w-24" },
  ];
  return (
    <div className="flex flex-col gap-3 p-4" aria-hidden>
      {bubbles.map((b, i) => (
        <div
          key={i}
          className={cn("flex", b.mine ? "justify-end" : "justify-start")}
        >
          <Skeleton
            className={cn(
              "h-9 rounded-2xl",
              b.w,
              b.mine
                ? "rounded-br-md bg-violet-300/40 dark:bg-violet-400/15"
                : "rounded-bl-md",
            )}
          />
        </div>
      ))}
    </div>
  );
}
