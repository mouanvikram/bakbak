import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Human-readable "last seen" label, e.g. "Last seen 5m ago",
 * "Last seen yesterday", or "Last seen Sep 12" for older gaps.
 */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Offline";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Offline";

  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(new Date(then), yesterday)) return "Last seen yesterday";

  return `Last seen ${new Date(then).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })}`;
}
