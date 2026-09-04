import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { SessionType } from "@bakbak/contracts";
import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "@/features/auth/api";
import { Spinner } from "@/components/ui/Spinner";

function isMobile(ua: string | null | undefined) {
  return !!ua && /Mobi|Android|iPhone|iPad|iPod/.test(ua);
}

function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function signedInLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Signed in just now";
  if (mins < 60) return `Signed in ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Signed in ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Signed in ${days} day${days === 1 ? "" : "s"} ago`;
  return `Signed in ${new Date(iso).toLocaleDateString()}`;
}

export function DevicesPage() {
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyOthers, setBusyOthers] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listSessions()
      .then((res) => {
        // Current session first, then newest.
        setSessions(
          [...res.sessions].sort(
            (a, b) =>
              Number(b.current) - Number(a.current) ||
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
        setError("");
      })
      .catch(() => setError("Couldn't load your sessions"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id: string) {
    setBusyId(id);
    setError("");
    try {
      await revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end that session");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeOthers() {
    setBusyOthers(true);
    setError("");
    try {
      await revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end sessions");
    } finally {
      setBusyOthers(false);
    }
  }

  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Devices</h1>
        <p className="text-sm text-gray-500">
          Places you're currently signed in. Ending a session signs that device
          out on its next check-in.
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((s) => {
            const Icon = isMobile(s.userAgent) ? Smartphone : Monitor;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-5 shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {deviceLabel(s.userAgent)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {s.current
                        ? "This device"
                        : signedInLabel(s.createdAt)}
                    </p>
                  </div>
                </div>
                {s.current ? (
                  <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId !== null || busyOthers}
                    onClick={() => handleRevoke(s.id)}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === s.id && <Spinner className="size-3.5" />}
                    Log out
                  </button>
                )}
              </div>
            );
          })}

          {otherCount > 0 && (
            <button
              type="button"
              disabled={busyOthers || busyId !== null}
              onClick={handleRevokeOthers}
              className="flex h-11 w-fit items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyOthers && <Spinner className="size-4" />}
              Log out {otherCount} other session{otherCount === 1 ? "" : "s"}
            </button>
          )}

          {sessions.length === 0 && (
            <p className="text-sm text-gray-400">No active sessions.</p>
          )}
        </div>
      )}
    </div>
  );
}
