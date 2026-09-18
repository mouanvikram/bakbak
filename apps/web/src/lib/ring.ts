/**
 * Call ringing, synthesised rather than played from a file.
 *
 * `playSound` can't do this: those clips are 70ms–1s one-shots that get
 * dropped if they can't start within 250ms, whereas a ring has to loop until
 * it's answered and stop on the same frame that it is. A ring is also just a
 * pair of sine tones on a cadence, so there's nothing to ship — no asset, no
 * decode, and it loops seamlessly for as long as you like.
 *
 * The two ends deliberately sound different, so you can tell from across the
 * room whether your phone is ringing or theirs:
 *   ringback — what the caller hears while waiting (slow, 440+480Hz)
 *   ringtone — what the callee hears (faster double-pulse, 660+880Hz)
 *
 * Both honour the Settings → Notifications → Sounds switch.
 */

import { areSoundsEnabled } from "@/lib/sounds";

export type RingKind = "ringback" | "ringtone";

interface Cadence {
  freqs: number[];
  /** Alternating on/off durations in ms, starting with "on". */
  pattern: number[];
  volume: number;
}

const CADENCES: Record<RingKind, Cadence> = {
  // Shorter than the 2s-on/4s-off of a real phone network: in an app the
  // long silence reads as "nothing is happening".
  ringback: { freqs: [440, 480], pattern: [1200, 2400], volume: 0.12 },
  ringtone: { freqs: [660, 880], pattern: [400, 200, 400, 1600], volume: 0.16 },
};

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let stopCurrentBurst: (() => void) | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** One audible pulse. Ramped in and out so it doesn't click. */
function burst(c: AudioContext, cadence: Cadence, ms: number): () => void {
  const seconds = ms / 1000;
  const now = c.currentTime;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(cadence.volume, now + 0.02);
  gain.gain.setValueAtTime(cadence.volume, now + Math.max(0.03, seconds - 0.03));
  gain.gain.linearRampToValueAtTime(0, now + seconds);
  gain.connect(c.destination);

  const oscillators = cadence.freqs.map((frequency) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
    return osc;
  });

  return () => {
    for (const osc of oscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped on its own schedule.
      }
    }
    gain.disconnect();
  };
}

/**
 * Starts ringing, replacing any ring already going.
 *
 * Silent if sounds are off, or if the browser still refuses audio because the
 * page has never been interacted with — an incoming call arrives without a
 * user gesture, and no amount of asking changes that. The call UI is visible
 * either way, so a muted ring degrades to a silent one rather than a missed
 * call.
 */
export function startRing(kind: RingKind): void {
  stopRing();
  if (!areSoundsEnabled()) return;

  const c = context();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});

  const cadence = CADENCES[kind];
  let step = 0;

  const tick = () => {
    const ms = cadence.pattern[step % cadence.pattern.length]!;
    // Even steps are tone, odd steps are silence.
    if (step % 2 === 0 && c.state === "running") {
      stopCurrentBurst = burst(c, cadence, ms);
    }
    step += 1;
    timer = setTimeout(tick, ms);
  };

  tick();
}

export function stopRing(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (stopCurrentBurst) {
    stopCurrentBurst();
    stopCurrentBurst = null;
  }
}
