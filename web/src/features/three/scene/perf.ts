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
 * Collects the time between drawn frames while something moves. A gap over 250 ms means the
 * scene rested in between; it is not a frame time. A fixed ring: no allocation per frame.
 */
export class FrameMeter {
  readonly times: Float64Array;
  count = 0;
  private next = 0;
  private last = 0;

  constructor(size = 120) {
    this.times = new Float64Array(size);
  }

  /** Records a frame drawn at `now` (ms). Returns the gap to the frame before, or 0 after a rest. */
  tick(now: number): number {
    const gap = this.last > 0 ? now - this.last : 0;
    this.last = now;
    if (gap <= 0 || gap > 250) return 0;
    this.times[this.next] = gap;
    this.next = (this.next + 1) % this.times.length;
    this.count = Math.min(this.count + 1, this.times.length);
    return gap;
  }

  /** Forgets the frames so far; the next frame starts a new run. */
  reset(): void {
    this.count = 0;
    this.next = 0;
    this.last = 0;
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
