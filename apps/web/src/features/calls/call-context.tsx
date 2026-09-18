import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CallTypeType } from "@bakbak/contracts";
import { useSocket } from "@/features/chat/socket-context";
import { useSocketEvent } from "@/features/chat/hooks/use-socket-event";
import { getIceServers } from "@/features/calls/api";
import { startRing, stopRing } from "@/lib/ring";
import { reportError } from "@/lib/report";
import { useToast } from "@/components/ui/Toast";

/**
 * One call at a time, for the whole app.
 *
 * The server relays the handshake; everything here is the browser half of it.
 * Media never goes through the API — once the peers agree, audio and video
 * flow directly (or through TURN when a direct path can't be opened).
 */

export type CallPhase =
  | "idle"
  /** We rang; waiting for them to pick up. */
  | "outgoing"
  /** They rang; waiting for us. */
  | "incoming"
  /** Answered on both sides; media still negotiating. */
  | "connecting"
  | "active";

export interface CallPeer {
  id: string;
  name: string;
  avatar?: string | null;
}

interface CallContextValue {
  phase: CallPhase;
  callType: CallTypeType;
  peer: CallPeer | null;
  chatId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micMuted: boolean;
  cameraOff: boolean;
  /** Seconds since the call connected; 0 until then. */
  elapsed: number;
  startCall: (
    chatId: string,
    peer: CallPeer,
    callType: CallTypeType,
  ) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
}

/**
 * How long an unanswered call rings before it gives up.
 *
 * Both ends run the clock, but the callee's runs a few seconds longer: the
 * caller's `call:end` normally lands first, so only one side reports the
 * outcome. The callee's is the safety net for the case the caller's tab died
 * mid-ring and no `call:end` is ever coming.
 */
const RING_TIMEOUT_MS = 45_000;
const RING_TIMEOUT_GRACE_MS = 5_000;

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}

/** Audio always; video only for a video call, so a voice call never opens the
 * camera (no hardware indicator, no track to forget to mute). */
function constraintsFor(callType: CallTypeType): MediaStreamConstraints {
  return callType === "VIDEO"
    ? { audio: true, video: { facingMode: "user" } }
    : { audio: true, video: false };
}

export function CallProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [callType, setCallType] = useState<CallTypeType>("AUDIO");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Internal only: every value set here is surfaced as a toast below and then
  // cleared, so there is nothing for a consumer to read.
  const [error, setError] = useState<string | null>(null);

  const { error: toastError } = useToast();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const chatIdRef = useRef<string | null>(null);
  /** The offer we were rung with, held until the user accepts. */
  const offerRef = useRef<RTCSessionDescriptionInit | null>(null);
  /**
   * Candidates that arrived before the remote description was set.
   * Trickle ICE regularly delivers these first, and addIceCandidate throws
   * without a remote description — dropping them is the classic cause of a
   * call that rings, answers, and then never connects.
   */
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const teardown = useCallback(() => {
    stopRing();
    pcRef.current?.close();
    pcRef.current = null;
    for (const track of localRef.current?.getTracks() ?? []) track.stop();
    localRef.current = null;
    pendingCandidates.current = [];
    offerRef.current = null;
    chatIdRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setPhase("idle");
    setPeer(null);
    setChatId(null);
    setMicMuted(false);
    setCameraOff(false);
    setElapsed(0);
  }, []);

  /** A peer connection wired to this call's chat, ready for tracks. */
  const createPeerConnection = useCallback(
    async (forChatId: string) => {
      const { iceServers } = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (!event.candidate || !socket) return;
        socket.emit("call:ice-candidate", {
          chatId: forChatId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) setRemoteStream(stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          stopRing();
          setPhase("active");
        }
        if (pc.connectionState === "failed") {
          setError("The connection dropped.");
          socket?.emit("call:end", { chatId: forChatId, reason: "FAILED" });
          teardown();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, teardown],
  );

  const attachLocalMedia = useCallback(
    async (pc: RTCPeerConnection, type: CallTypeType) => {
      const stream = await navigator.mediaDevices.getUserMedia(
        constraintsFor(type),
      );
      localRef.current = stream;
      setLocalStream(stream);
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      return stream;
    },
    [],
  );

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingCandidates.current;
    pendingCandidates.current = [];
    for (const candidate of queued) {
      await pc.addIceCandidate(candidate).catch((err: unknown) => {
        reportError("calls:addIceCandidate", err);
      });
    }
  }, []);

  // ── Outgoing ───────────────────────────────────────────────────────────

  const startCall = useCallback(
    async (targetChatId: string, targetPeer: CallPeer, type: CallTypeType) => {
      if (phase !== "idle" || !socket) return;

      setError(null);
      setCallType(type);
      setPeer(targetPeer);
      setChatId(targetChatId);
      chatIdRef.current = targetChatId;
      setPhase("outgoing");

      try {
        const pc = await createPeerConnection(targetChatId);
        await attachLocalMedia(pc, type);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:offer", {
          chatId: targetChatId,
          sdp: offer.sdp ?? "",
          callType: type,
        });

        startRing("ringback");
      } catch (err) {
        reportError("calls:startCall", err);
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? type === "VIDEO"
              ? "Camera and microphone access was blocked."
              : "Microphone access was blocked."
            : "Couldn't start the call.",
        );
        teardown();
      }
    },
    [phase, socket, createPeerConnection, attachLocalMedia, teardown],
  );

  // ── Incoming ───────────────────────────────────────────────────────────

  useSocketEvent<{
    chatId: string;
    from: string;
    fromUsername: string;
    sdp: string;
    callType: CallTypeType;
  }>(socket, "call:incoming", (payload) => {
    // Already busy: tell them rather than ringing over the top of a live call.
    if (phase !== "idle") {
      socket?.emit("call:end", { chatId: payload.chatId, reason: "BUSY" });
      return;
    }
    offerRef.current = { type: "offer", sdp: payload.sdp };
    setCallType(payload.callType);
    setPeer({ id: payload.from, name: payload.fromUsername });
    setChatId(payload.chatId);
    chatIdRef.current = payload.chatId;
    setPhase("incoming");
    startRing("ringtone");
  });

  const accept = useCallback(async () => {
    const offer = offerRef.current;
    const activeChatId = chatIdRef.current;
    if (!offer || !activeChatId || !socket) return;

    stopRing();
    setPhase("connecting");

    try {
      const pc = await createPeerConnection(activeChatId);
      await attachLocalMedia(pc, callType);
      await pc.setRemoteDescription(offer);
      await flushCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", {
        chatId: activeChatId,
        sdp: answer.sdp ?? "",
      });
    } catch (err) {
      reportError("calls:accept", err);
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? callType === "VIDEO"
            ? "Camera and microphone access was blocked."
            : "Microphone access was blocked."
          : "Couldn't answer the call.",
      );
      socket.emit("call:end", { chatId: activeChatId, reason: "FAILED" });
      teardown();
    }
  }, [
    socket,
    callType,
    createPeerConnection,
    attachLocalMedia,
    flushCandidates,
    teardown,
  ]);

  // Caller's side of the handshake completing.
  useSocketEvent<{ chatId: string; from: string; sdp: string }>(
    socket,
    "call:answered",
    (payload) => {
      const pc = pcRef.current;
      if (!pc || payload.chatId !== chatIdRef.current) return;
      stopRing();
      setPhase("connecting");
      void (async () => {
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
          await flushCandidates(pc);
        } catch (err) {
          reportError("calls:setRemoteDescription", err);
        }
      })();
    },
  );

  useSocketEvent<{ chatId: string; candidate: RTCIceCandidateInit }>(
    socket,
    "call:ice-candidate",
    (payload) => {
      if (payload.chatId !== chatIdRef.current) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidates.current.push(payload.candidate);
        return;
      }
      void pc.addIceCandidate(payload.candidate).catch((err: unknown) => {
        reportError("calls:addIceCandidate", err);
      });
    },
  );

  useSocketEvent<{ chatId: string; reason: string }>(
    socket,
    "call:ended",
    (payload) => {
      if (payload.chatId !== chatIdRef.current) return;
      if (payload.reason === "BUSY") setError("They're on another call.");
      teardown();
    },
  );

  // ── Controls ───────────────────────────────────────────────────────────

  const end = useCallback(
    (reason: "HANGUP" | "REJECTED" | "TIMEOUT") => {
      const activeChatId = chatIdRef.current;
      if (activeChatId && socket) {
        socket.emit("call:end", { chatId: activeChatId, reason });
      }
      teardown();
    },
    [socket, teardown],
  );

  const hangup = useCallback(() => end("HANGUP"), [end]);
  const decline = useCallback(() => end("REJECTED"), [end]);

  const toggleMic = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;
    const next = !tracks[0]!.enabled;
    for (const track of tracks) track.enabled = next;
    setMicMuted(!next);
  }, []);

  const toggleCamera = useCallback(() => {
    const tracks = localRef.current?.getVideoTracks() ?? [];
    if (tracks.length === 0) return;
    const next = !tracks[0]!.enabled;
    for (const track of tracks) track.enabled = next;
    setCameraOff(!next);
  }, []);

  // Every failure the provider records reaches the user exactly once.
  //
  // It has to be a toast rather than a banner inside the call UI: `teardown`
  // sets phase to "idle", which unmounts both CallScreen and
  // IncomingCallModal — so by the time an error is set there is no call
  // surface left on screen to show it in. Blocked microphone permission is
  // the common case, and without this the call window simply vanished with
  // no explanation at all.
  //
  // Cleared after showing so an identical message fires again next time.
  useEffect(() => {
    if (!error) return;
    toastError(error);
    setError(null);
  }, [error, toastError]);

  // Ring-out. Without it, calling someone who never picks up rings until the
  // caller gives up by hand — and a callee whose caller vanished rings forever.
  useEffect(() => {
    if (phase !== "outgoing" && phase !== "incoming") return;

    const after =
      phase === "outgoing"
        ? RING_TIMEOUT_MS
        : RING_TIMEOUT_MS + RING_TIMEOUT_GRACE_MS;

    const timer = setTimeout(() => {
      // Only the caller is told why: on the callee's side the window simply
      // stops ringing, which is what an unanswered call looks like anyway.
      if (phase === "outgoing") setError("No answer.");
      end("TIMEOUT");
    }, after);

    return () => clearTimeout(timer);
  }, [phase, end]);

  // Call duration, counted from the moment media actually connected.
  useEffect(() => {
    if (phase !== "active") return;
    const startedAt = Date.now();
    setElapsed(0);
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [phase]);

  // Losing the socket mid-call means no more signalling — end it rather than
  // leave a dead window open.
  useEffect(() => {
    if (!socket && phase !== "idle") teardown();
  }, [socket, phase, teardown]);

  useEffect(() => teardown, [teardown]);

  return (
    <CallContext.Provider
      value={{
        phase,
        callType,
        peer,
        chatId,
        localStream,
        remoteStream,
        micMuted,
        cameraOff,
        elapsed,
        startCall,
        accept,
        decline,
        hangup,
        toggleMic,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}
