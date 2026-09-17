/**
 * Every visible timestamp goes through one of these, so the same instant reads
 * the same way wherever it appears.
 *
 * All of them take the ISO strings the API returns, and render an empty string
 * for anything that isn't a date rather than showing "Invalid Date" to a person.
 */

const MINUTE_MS = 60_000;

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Clock time, e.g. "09:41". */
export function formatTime(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Day and month, e.g. "Sep 12". */
export function formatDay(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Numeric date in the viewer's locale, e.g. "12/09/2026". */
export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";
  return date.toLocaleDateString();
}

/** Full date, e.g. "12 September 2026". */
export function formatFullDate(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Month and year, e.g. "September 2026". */
export function formatMonthYear(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

/**
 * How long ago `iso` was, while that still reads as recent: "just now",
 * "5m ago", "3h ago", "yesterday".
 *
 * Returns null for anything older — a gap of weeks is clearer as a date — so
 * the caller picks the absolute format that suits it.
 */
export function relativeSince(iso: string | null | undefined): string | null {
  const date = parse(iso);
  if (!date) return null;

  // Floor, not round: 59 seconds ago is "just now", not "1m ago". A clock
  // running behind the server's can put this slightly in the future.
  const minutes = Math.floor((Date.now() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (isYesterday(date)) return "yesterday";
  return null;
}

/** Whole days since `iso`, or null if it isn't a date. */
export function daysSince(iso: string | null | undefined): number | null {
  const date = parse(iso);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * MINUTE_MS));
}

/**
 * Presence label, e.g. "Last seen 5m ago", "Last seen yesterday", or
 * "Last seen Sep 12". "Offline" stands in when we've never seen them.
 */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!parse(iso)) return "Offline";
  return `Last seen ${relativeSince(iso) ?? formatDay(iso)}`;
}
