import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  APP_VERSION,
  compareVersions,
  fetchServerVersion,
  type UpdateStatus,
} from "@/lib/version";

const BUILT_WITH = [
  "React 19 + Vite + Tailwind CSS",
  "Bun + Express 5 + Socket.IO",
  "PostgreSQL + Prisma",
  "S3-compatible object storage",
];

const DATA_WE_STORE = [
  "Your email, username and profile (name, bio, avatar)",
  "Your chats, messages and the files you send",
  "Your friends and friend requests",
  "Login sessions (device User-Agent) and your settings",
];

export function AboutBakbakPage() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    fetchServerVersion().then((server) => {
      if (!cancelled) setStatus(compareVersions(server));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">About BakBak</h1>
        <p className="text-sm text-gray-500">
          What this is, and how your data is handled
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-gray-600">
          BakBak is a real-time chat app — direct and group messaging with
          friends, media sharing, presence, typing indicators and read receipts.
          It's an in-development project built to explore a full-stack realtime
          architecture, so some things (notifications, calls, running across
          more than one server) aren't finished yet.
        </p>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">Version</p>
              <p className="font-mono text-sm text-gray-500">{APP_VERSION}</p>
            </div>
            <VersionStatus status={status} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <p className="font-semibold text-gray-900">Built with</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
            {BUILT_WITH.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <p className="font-semibold text-gray-900">Your data</p>
          <p className="mt-1 text-sm text-gray-500">
            Kept to what's needed to run the app:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
            {DATA_WE_STORE.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Passwords are hashed with Argon2id and never stored in the clear.
            Nothing is sold or shared with third parties. Deleting your account
            (Settings → Security &amp; Privacy) permanently removes all of the
            above.
          </p>
        </div>
      </div>
    </div>
  );
}

function VersionStatus({ status }: { status: UpdateStatus }) {
  if (status.state === "checking") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 className="size-3.5 animate-spin" />
        Checking…
      </span>
    );
  }

  if (status.state === "latest") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
        <CheckCircle2 className="size-4" />
        Latest version
      </span>
    );
  }

  if (status.state === "outdated") {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        title={`Deployed: ${status.latest}`}
      >
        <RefreshCw className="size-3.5" />
        Update available — reload
      </button>
    );
  }

  // "unknown" — local build, or the version endpoint didn't answer.
  return null;
}
