/**
 * Interface sounds. Files live in /public/sounds and are BakBak's own,
 * synthesized by scripts/generate-sounds.mjs (`npm run sounds`) — edit a
 * recipe there to change a sound.
 *
 * Played through the Web Audio API rather than <audio> elements: the clips
 * are 70ms–1s, and a media element's start-up latency swallows most of a
 * clip that short. Decoded buffers start sample-accurate and overlap freely.
 *
 * The on/off switch mirrors Settings → Notifications → Sounds: it's kept in
 * localStorage for an instant value and reconciled with the API once the
 * settings load (ChatPreferencesProvider) or are saved (NotificationsPage).
 */

import { STORAGE_KEYS, readString, writeString } from "@/lib/storage";

interface SoundSpec {
  src: string;
  volume: number;
  /** Triggers of this sound closer together than this play once. */
  minGapMs?: number;
  /** Random ± playback-rate spread, so a repeated sound doesn't feel canned. */
  pitchJitter?: number;
}

const SOUNDS = {
  // Chat
  typing: {
    // Key clicks in the composer: quiet, fast, and slightly varied.
    src: "/sounds/typing.mp3",
    volume: 0.25,
    minGapMs: 35,
    pitchJitter: 0.08,
  },
  send: { src: "/sounds/send.mp3", volume: 0.45 },
  upload: { src: "/sounds/upload.mp3", volume: 0.45 },
  receive: { src: "/sounds/receive.mp3", volume: 0.4 },
  message: { src: "/sounds/message.mp3", volume: 0.6 },
  reaction: { src: "/sounds/reaction.mp3", volume: 0.4, pitchJitter: 0.05 },
  edit: { src: "/sounds/edit.mp3", volume: 0.35 },
  delete: { src: "/sounds/delete.mp3", volume: 0.35 },
  jump: { src: "/sounds/jump.mp3", volume: 0.2 },

  // Friends
  friendRequest: { src: "/sounds/friend-request.mp3", volume: 0.4 },
  friendAccept: { src: "/sounds/friend-accept.mp3", volume: 0.5 },
  friendDecline: { src: "/sounds/friend-decline.mp3", volume: 0.35 },

  // Menus and dialogs
  menu: { src: "/sounds/menu.mp3", volume: 0.25 },
  confirm: { src: "/sounds/confirm.mp3", volume: 0.35 },
  groupCreated: { src: "/sounds/group-created.mp3", volume: 0.5 },

  // Account, settings and feedback
  success: { src: "/sounds/success.mp3", volume: 0.4 },
  alert: { src: "/sounds/alert.mp3", volume: 0.5 },
  otpError: { src: "/sounds/otp-error.mp3", volume: 0.5 },
  theme: { src: "/sounds/theme.mp3", volume: 0.35 },
  toggleOn: { src: "/sounds/toggle-on.mp3", volume: 0.4 },
  toggleOff: { src: "/sounds/toggle-off.mp3", volume: 0.4 },
} satisfies Record<string, SoundSpec>;

export type SoundName = keyof typeof SOUNDS;

const NAMES = Object.keys(SOUNDS) as SoundName[];
const DEFAULT_MIN_GAP_MS = 80;
// A sound that can't start within this window (still decoding, context
// waking up) is dropped — a late blip is worse than none.
const MAX_LATENCY_MS = 250;

let enabled = readString(STORAGE_KEYS.sounds, "on") !== "off";
let ctx: AudioContext | null = null;
const files = new Map<SoundName, Promise<ArrayBuffer | null>>();
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<SoundName, number>();

export function setSoundsEnabled(next: boolean) {
  enabled = next;
  writeString(STORAGE_KEYS.sounds, next ? "on" : "off");
}

/**
 * Whether interface sounds are on. Exported for the call ringer, which can't
 * go through `playSound`: these clips are one-shots that get dropped after
 * 250ms of latency, whereas a ring has to loop until it's answered.
 */
export function areSoundsEnabled(): boolean {
  return enabled;
}

function file(name: SoundName): Promise<ArrayBuffer | null> {
  let p = files.get(name);
  if (!p) {
    p = fetch(SOUNDS[name].src)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
    files.set(name, p);
  }
  return p;
}

function buffer(c: AudioContext, name: SoundName): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    p = file(name)
      // decodeAudioData detaches its input, so hand it a copy.
      .then((data) => (data ? c.decodeAudioData(data.slice(0)) : null))
      .catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

// Browsers only let audio start after a user gesture. The context is created
// on the first one (so there's no autoplay warning), and every clip is
// decoded then so later plays start immediately.
function unlock() {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    for (const name of NAMES) void buffer(ctx, name);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
}

export function playSound(name: SoundName) {
  if (!enabled || !ctx) return;

  const spec: SoundSpec = SOUNDS[name];
  const requestedAt = performance.now();
  const gap = spec.minGapMs ?? DEFAULT_MIN_GAP_MS;
  if (requestedAt - (lastPlayed.get(name) ?? -Infinity) < gap) return;
  lastPlayed.set(name, requestedAt);

  const c = ctx;
  const ready =
    c.state === "running" ? Promise.resolve() : c.resume().catch(() => {});

  void Promise.all([buffer(c, name), ready]).then(([buf]) => {
    if (!buf || c.state !== "running") return;
    if (performance.now() - requestedAt > MAX_LATENCY_MS) return;
    const source = c.createBufferSource();
    source.buffer = buf;
    if (spec.pitchJitter) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * spec.pitchJitter;
    }
    const gain = c.createGain();
    gain.gain.value = spec.volume;
    source.connect(gain).connect(c.destination);
    source.start();
  });
}

if (typeof window !== "undefined") {
  // Fetch the (tiny) files up front; decoding waits for the first gesture.
  for (const name of NAMES) void file(name);
  for (const type of ["pointerdown", "keydown", "touchstart"] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}
