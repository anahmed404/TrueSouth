/*
  Pure motion decisions, kept out of the components so they can be tested in Node.
  Durations are in seconds (Motion's unit) unless a name ends in Ms.
*/

/**
 * Whether to reduce motion. An explicit prop wins; otherwise the system setting.
 * `system` is null when it cannot be read (no window), which counts as "no".
 */
export function resolveReducedMotion(override: boolean | undefined, system: boolean | null): boolean {
  return override ?? system ?? false;
}

export type LunaMotionPlan = {
  /** Gentle up-and-down float while idle. */
  idleBob: boolean;
  /** Occasional blink. */
  blink: boolean;
  /** Cross-fade length when the mood changes. 0 means swap instantly. */
  moodFade: number;
  /** A small squash-and-settle of the body on a mood change. */
  moodPop: boolean;
};

export function lunaMotionPlan(reduced: boolean): LunaMotionPlan {
  return reduced
    ? { idleBob: false, blink: false, moodFade: 0, moodPop: false }
    : { idleBob: true, blink: true, moodFade: 0.22, moodPop: true };
}

export const BLINK_MIN_MS = 2500;
export const BLINK_MAX_MS = 6000;
export const BLINK_CLOSED_MS = 140;

/** Wait before the next blink. `random` is a number in [0, 1), e.g. Math.random(). */
export function nextBlinkDelayMs(random: number): number {
  const r = Math.min(Math.max(random, 0), 1);
  return Math.round(BLINK_MIN_MS + r * (BLINK_MAX_MS - BLINK_MIN_MS));
}

export type CelebrationKind = "correct" | "lesson-complete";

export type CelebrationPlan = {
  /** Luna's size in px during the celebration. */
  lunaSize: number;
  /** Number of confetti pieces. 0 when motion is reduced or confetti is off. */
  confetti: number;
  /** Luna hops; height in px. 0 means she stays put. */
  hop: number;
  /** How long the burst lasts. */
  duration: number;
};

/**
 * "A short burst of confetti and Luna cheering on each correct answer; a bigger one at
 * lesson end" (docs/academy/overview.md, Game rules). Luna always cheers; only the
 * movement is dropped with reduced motion.
 */
export function celebrationPlan(
  kind: CelebrationKind,
  reduced: boolean,
  confettiWanted = true,
): CelebrationPlan {
  const big = kind === "lesson-complete";
  const moving = !reduced;
  return {
    lunaSize: big ? 128 : 72,
    confetti: moving && confettiWanted ? (big ? 36 : 14) : 0,
    hop: moving ? (big ? 18 : 10) : 0,
    duration: big ? 1.6 : 0.9,
  };
}

export type ConfettiPiece = {
  /** Horizontal travel in px, negative is left. */
  x: number;
  /** Peak height in px (upwards). */
  rise: number;
  /** Final rotation in degrees. */
  spin: number;
  /** Start delay in seconds. */
  delay: number;
  /** Index into the confetti colour list. */
  colour: number;
};

/** A small seeded generator, so a burst looks the same every time it is replayed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function confettiPieces(
  count: number,
  spread: number,
  colours: number,
  seed = 1,
): ConfettiPiece[] {
  const rand = mulberry32(seed);
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => ({
    x: Math.round((rand() * 2 - 1) * spread),
    rise: Math.round(spread * (0.4 + rand() * 0.6)),
    spin: Math.round((rand() * 2 - 1) * 540),
    delay: Math.round(rand() * 120) / 1000,
    colour: colours > 0 ? i % colours : 0,
  }));
}
