import { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useCall } from "@/features/calls/call-context";
import { usePresence } from "@/features/chat/presence-context";
import { formatDuration } from "@/lib/date";

/**
 * The live call surface.
 *
 * Stays dark in both themes on purpose. The app's dark mode works by remapping
 * palette utilities (see styles/index.css), so `bg-white` here would follow the
 * theme — but a call is a video surface, and video reads correctly against
 * near-black in daylight too. `slate-900` has no `.dark` remap, so it holds.
 */
export function CallScreen() {
  const {
    phase,
    callType,
    peer,
    localStream,
    remoteStream,
    micMuted,
    cameraOff,
    elapsed,
    hangup,
    toggleMic,
    toggleCamera,
  } = useCall();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const { isOnline } = usePresence();

  // "Ringing" asserts their device is alerting them. With no live socket the
  // offer reached nobody and nothing is ringing anywhere, so the caller is
  // only "Calling". Read live rather than snapshotted at dial time, so it
  // flips to "Ringing" the moment they come online mid-attempt.
  const peerOnline = isOnline(peer?.id);

  const isVideo = callType === "VIDEO";
  const onCall = phase === "outgoing" || phase === "connecting" || phase === "active";

  // Streams are attached imperatively: srcObject takes a MediaStream, which
  // can't go through a React attribute.
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    // A voice call still needs the remote audio playing somewhere.
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isVideo]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!onCall || !peer) return null;

  const status =
    phase === "outgoing"
      ? (peerOnline ? "Ringing…" : "Calling…")
      : phase === "connecting"
        ? "Connecting…"
        : formatDuration(elapsed);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo ? "Video" : "Voice"} call with ${peer.name}`}
      className="fixed inset-0 flex flex-col bg-slate-900 text-white motion-safe:animate-[fade-in_150ms_var(--ease-emphasized)]"
      style={{ zIndex: "var(--z-modal)" }}
    >
      {/* Remote audio always plays, even in a video call where the <video>
          element would also carry it — one element owns playback. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="size-full object-cover"
          />
        ) : (
          // Voice call, or video that hasn't arrived yet: the person, not a
          // black rectangle.
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <Avatar name={peer.name} src={peer.avatar} className="size-28" />
            <h2 className="text-xl font-semibold">{peer.name}</h2>
            <p className="text-sm text-white/70">{status}</p>
          </div>
        )}

        {/* Own camera, corner-inset. Video calls only — there's no preview
            worth showing for a voice call. */}
        {isVideo && localStream && !cameraOff && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute right-4 bottom-4 aspect-[3/4] w-28 rounded-xl object-cover shadow-lg ring-1 ring-white/20 sm:w-36"
          />
        )}

        {/* With video on screen the name/timer move out of the middle. */}
        {isVideo && remoteStream && (
          <div className="absolute top-0 right-0 left-0 bg-linear-to-b from-black/60 to-transparent p-4 text-center">
            <h2 className="truncate text-base font-semibold">{peer.name}</h2>
            <p className="text-xs text-white/70">{status}</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-4 pb-10">
        <button
          type="button"
          onClick={toggleMic}
          aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={micMuted}
          className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          {micMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>

        {/* No camera control on a voice call: there is no video track to
            toggle, and offering one would imply the camera is already on. */}
        {isVideo && (
          <button
            type="button"
            onClick={toggleCamera}
            aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
            aria-pressed={cameraOff}
            className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            {cameraOff ? (
              <VideoOff className="size-5" />
            ) : (
              <Video className="size-5" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={hangup}
          aria-label="End call"
          className="flex size-14 items-center justify-center rounded-full bg-red-500 text-white transition-transform active:scale-90"
        >
          <PhoneOff className="size-6" />
        </button>
      </div>
    </div>
  );
}
