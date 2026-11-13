/**
 * How the scene keeps its frame rate on a weak machine without lowering the picture on a
 * strong one (docs/features/system-view.md, "Performance"). Pure logic, tested without
 * WebGL; the Director applies it.
 *
 * Quality stages, from the full picture down. A machine starts at stage 0, which is the
 * picture the scene has always drawn, still and moving. Only frames measured while something
 * moves can step it down. At rest every stage draws at the full resolution it allows, so a
 * still picture stays sharp; stages 1 and up draw fewer pixels only while moving.
 */

export type QualityStage = {
  /** The device pixel ratio drawn at rest. */
  restDpr: number;
  /** The share of the rest pixel ratio drawn while the camera or the time moves (1: no change). */
  movingScale: number;
};

/** The stages for a device pixel ratio `deviceDpr`. Stage 0 is today's picture. */
export function qualityStages(deviceDpr: number): QualityStage[] {
  const full = Math.min(Math.max(deviceDpr, 1), 2);
  return [
    { restDpr: full, movingScale: 1 },
    // Dynamic resolution: sharp at rest, 60 % of the pixel ratio (a third of the pixels) while moving.
    { restDpr: full, movingScale: 0.6 },
    // A high-density screen draws at 1.25 at rest; moving, half that.
    { restDpr: Math.min(full, 1.25), movingScale: 0.5 },
    // The last stage: 0.85 at rest, half that moving.
    { restDpr: Math.min(full, 0.85), movingScale: 0.5 },
  ];
}

/** The pixel ratio to draw at now, rounded to 1/20 so small differences do not reallocate the canvas. */
export function drawDpr(stage: QualityStage, moving: boolean): number {
  const dpr = moving ? stage.restDpr * stage.movingScale : stage.restDpr;
  return Math.max(0.35, Math.round(dpr * 20) / 20);
}

/** A moving frame slower than this (under about 28 frames a second) counts toward a step down. */
export const STEP_DOWN_MS = 36;
/** The median of this many moving frames decides a step. */
export const WINDOW_FRAMES = 24;
/**
 * At the last stage, a median over this is still slow: the scene offers the still picture
 * (docs/features/system-view.md, "When 3D does not run"; the threshold is still a guess).
 */
export const SLOW_MEDIAN_MS = 55;

function sortedPrefix(values: ArrayLike<number>, count: number): number[] {
  return Array.from({ length: count }, (_, i) => values[i] as number).sort((a, b) => a - b);
}

export function median(values: ArrayLike<number>, count = values.length): number {
  if (count <= 0) return 0;
  const sorted = sortedPrefix(values, count);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

export function percentile(values: ArrayLike<number>, p: number, count = values.length): number {
  if (count <= 0) return 0;
  const sorted = sortedPrefix(values, count);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
}

export type StageVerdict = { stage: number; slow: boolean };

/**
 * After a window of moving frames: step down when the median is over STEP_DOWN_MS (one stage,
 * or two when it is over three times that, so a weak machine reaches a usable stage in
 * seconds); at the last stage, report slow when it is still over SLOW_MEDIAN_MS. Never steps
 * back up within a visit: a stage that was too slow once stays dropped.
 */
export function judgeWindow(stage: number, lastStage: number, medianMs: number): StageVerdict {
  if (medianMs <= STEP_DOWN_MS) return { stage, slow: false };
  const drop = medianMs > 3 * STEP_DOWN_MS ? 2 : 1;
  if (stage < lastStage) return { stage: Math.min(lastStage, stage + drop), slow: false };
  return { stage, slow: medianMs > SLOW_MEDIAN_MS };
}

/**
 * Collects the time between drawn frames while something moves. A gap over `maxGap` means
 * the scene rested in between; it is not a frame time. A fixed ring: no allocation per frame.
 */
export class FrameMeter {
  readonly times: Float64Array;
  count = 0;
  private next = 0;
  private last = Number.NaN;

  /**
   * `maxGap`: the longest gap still counted as a frame. Frames drawn back to back (a flight)
   * can be slow on a weak machine, so the scene counts them up to a second.
   */
  constructor(
    size = 120,
    readonly maxGap = 250,
  ) {
    this.times = new Float64Array(size);
  }

  /** Records a frame drawn at `now` (ms). Returns the gap to the frame before, or 0 after a rest. */
  tick(now: number): number {
    const gap = Number.isNaN(this.last) ? 0 : now - this.last;
    this.last = now;
    if (gap <= 0 || gap > this.maxGap) return 0;
    this.times[this.next] = gap;
    this.next = (this.next + 1) % this.times.length;
    this.count = Math.min(this.count + 1, this.times.length);
    return gap;
  }

  /** Forgets the frames so far; the next frame starts a new run. */
  reset(): void {
    this.count = 0;
    this.next = 0;
    this.last = Number.NaN;
  }

  median(): number {
    return median(this.times, this.count);
  }

  p95(): number {
    return percentile(this.times, 0.95, this.count);
  }
}

/** The Moon sphere's levels of detail (segments around; half as many from pole to pole). The last is today's mesh. */
export const MOON_SEGMENTS = [64, 96, 128, 192, 256, 384] as const;
/** The full Moon mesh, as drawn before levels of detail. */
export const MOON_SEGMENTS_FULL = 384;

/**
 * How many segments the Moon sphere needs when its disc is `pixelRadius` device pixels
 * across the radius: enough that a facet's flat edge stays within a quarter of a pixel of the
 * true circle, R (1 − cos(π / N)) < 0.25, so N > π √(2R), with a third more for margin.
 * Shading is per pixel from the normalised position, so fewer segments change nothing but
 * that edge. Close up (or unknown), the full mesh, as today.
 */
export function moonSegments(pixelRadius: number): number {
  if (!Number.isFinite(pixelRadius) || pixelRadius <= 0) return MOON_SEGMENTS_FULL;
  const needed = Math.PI * Math.sqrt(2 * pixelRadius) * 1.33;
  return MOON_SEGMENTS.find((n) => n >= needed) ?? MOON_SEGMENTS_FULL;
}

/** A window whose median is under this (about 50 frames a second) counts toward stepping back up. */
export const STEP_UP_MS = 20;
/** This many fast windows in a row step the quality back up one stage. */
export const RECOVER_WINDOWS = 3;
/** A gap this many times the last window's median is a stall (a texture upload, a GC), not a frame. */
export const STALL_FACTOR = 4;

export type FrameSample = {
  /** Time since the frame before, in ms (0 or less: none). */
  gapMs: number;
  /** True while the camera flies (frames drawn back to back). Only these judge the stage. */
  moving: boolean;
  /** True while the tab is hidden. Those frames never count. */
  hidden: boolean;
};

export type GovernorVerdict = { stage: number; changed: boolean; slow: boolean };

/**
 * Chooses the quality stage from measured frames (the Director feeds it every drawn frame).
 *
 * - Only moving, visible frames count; a frame at rest or while hidden never moves the stage.
 * - A gap over a second, or over STALL_FACTOR times the last window's median, is a stall and
 *   is dropped, so a one-off upload cannot cost quality for the rest of the session.
 * - A window of WINDOW_FRAMES moving frames (or 6, when far too slow) is judged: slower than
 *   STEP_DOWN_MS steps down (judgeWindow); at the last stage, slower than SLOW_MEDIAN_MS says
 *   "slow" once.
 * - RECOVER_WINDOWS windows in a row faster than STEP_UP_MS step back up one stage.
 * - No oscillation: a stage that failed again within two windows of stepping up into it is
 *   never stepped up into again in this visit.
 */
export class QualityGovernor {
  stage = 0;
  private readonly window: Float64Array;
  private count = 0;
  private reference = 0;
  private fastRun = 0;
  /** The best stage the governor may step up to (a stage that failed after recovering is barred). */
  private ceiling = 0;
  private sinceStepUp = Number.POSITIVE_INFINITY;
  private slowSent = false;

  constructor(
    readonly lastStage: number,
    windowFrames = WINDOW_FRAMES,
  ) {
    this.window = new Float64Array(windowFrames);
  }

  /** Forgets the frames in hand (the tab was hidden, or the scene rested). Keeps the stage. */
  reset(): void {
    this.count = 0;
  }

  frame(sample: FrameSample): GovernorVerdict {
    const none = { stage: this.stage, changed: false, slow: false };
    if (sample.hidden) {
      this.count = 0;
      return none;
    }
    if (!sample.moving || !(sample.gapMs > 0)) return none;
    if (sample.gapMs > 1_000) return none;
    if (this.reference > 0 && sample.gapMs > STALL_FACTOR * this.reference && sample.gapMs > 2 * STEP_DOWN_MS) return none;
    this.window[this.count] = sample.gapMs;
    this.count += 1;
    const full = this.count >= this.window.length;
    const farTooSlow = this.count >= 6 && median(this.window, this.count) > 3 * STEP_DOWN_MS;
    if (!full && !farTooSlow) return none;
    const m = median(this.window, this.count);
    this.count = 0;
    this.reference = m;
    this.sinceStepUp += 1;
    const before = this.stage;
    if (m > STEP_DOWN_MS) {
      this.fastRun = 0;
      const verdict = judgeWindow(this.stage, this.lastStage, m);
      if (verdict.stage !== this.stage) {
        // Failing within two windows of stepping up: never step up past this stage again.
        if (this.sinceStepUp <= 2) this.ceiling = Math.max(this.ceiling, this.stage + 1);
        this.stage = verdict.stage;
      }
      const slow = verdict.slow && !this.slowSent;
      if (slow) this.slowSent = true;
      return { stage: this.stage, changed: this.stage !== before, slow };
    }
    if (m < STEP_UP_MS && this.stage > this.ceiling) {
      this.fastRun += 1;
      if (this.fastRun >= RECOVER_WINDOWS) {
        this.fastRun = 0;
        this.stage -= 1;
        this.sinceStepUp = 0;
      }
    } else {
      this.fastRun = 0;
    }
    return { stage: this.stage, changed: this.stage !== before, slow: false };
  }
}
