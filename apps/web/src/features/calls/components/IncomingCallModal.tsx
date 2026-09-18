import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useCall } from "@/features/calls/call-context";

/**
 * The ringing panel. Deliberately not the full call surface: until it's
 * answered there's no media to show, and a full-screen takeover for something
 * you might decline is too much.
 */
export function IncomingCallModal() {
  const { phase, callType, peer, accept, decline } = useCall();

  if (phase !== "incoming" || !peer) return null;

  const isVideo = callType === "VIDEO";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming ${isVideo ? "video" : "voice"} call`}
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 motion-safe:animate-[fade-in_150ms_var(--ease-emphasized)]"
      style={{ zIndex: "var(--z-modal)" }}
    >
      <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl motion-safe:animate-[pop-in_180ms_var(--ease-emphasized)]">
        <div className="flex justify-center">
          <Avatar name={peer.name} src={peer.avatar} className="size-20" />
        </div>

        <h2 className="mt-4 truncate text-lg font-semibold text-slate-900">
          {peer.name}
        </h2>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500">
          {isVideo ? (
            <Video className="size-4" />
          ) : (
            <Phone className="size-4" />
          )}
          Incoming {isVideo ? "video" : "voice"} call
        </p>

        <div className="mt-6 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={decline}
            aria-label="Decline call"
            className="flex size-14 items-center justify-center rounded-full bg-red-500 text-white transition-transform active:scale-90"
          >
            <PhoneOff className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => void accept()}
            aria-label="Answer call"
            className="flex size-14 items-center justify-center rounded-full bg-green-500 text-white transition-transform active:scale-90"
          >
            {isVideo ? (
              <Video className="size-6" />
            ) : (
              <Phone className="size-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
