import { resolveDegrees, type WorkedExamples } from "./placeholders";
import type { AzimuthWindow, SketchPoint } from "./types";

/**
 * The draw-skyline step's closeness rule. The rule is written in
 * docs/academy/overview.md ("Game rules"); this file only implements it.
 *
 * The real skyline comes from the Python pipeline. This file compares two given series;
 * it never computes a skyline.
 */

/** At or under this gap, in degrees, a sketch earns the full 10 XP. */
export const SKYLINE_FULL_XP_GAP_DEG = 0.25;
/** At or over this gap, in degrees, a sketch earns the floor of 2 XP. */
export const SKYLINE_FLOOR_XP_GAP_DEG = 2.0;
/** At or under this gap, in degrees, the step counts as right first time for stars. */
export const SKYLINE_FIRST_TIME_GAP_DEG = 1.0;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * XP = round(10 − 8 × clamp((gap − 0.25) / 1.75, 0, 1)).
 * 10 XP at 0.25° or closer, 2 XP at 2° or worse. A gap that is negative or not a
 * finite number is invalid and scores the floor.
 */
export function skylineXp(gapDeg: number): number {
  if (!Number.isFinite(gapDeg) || gapDeg < 0) return 2;
  const span = SKYLINE_FLOOR_XP_GAP_DEG - SKYLINE_FULL_XP_GAP_DEG;
  return Math.round(10 - 8 * clamp((gapDeg - SKYLINE_FULL_XP_GAP_DEG) / span, 0, 1));
}

/** True when the sketch is close enough to count as right first time for stars. */
export function skylineRightFirstTime(gapDeg: number): boolean {
  return Number.isFinite(gapDeg) && gapDeg >= 0 && gapDeg <= SKYLINE_FIRST_TIME_GAP_DEG;
}

/** The sketch's elevation at an azimuth, by straight lines between its points. */
function sketchAt(sorted: readonly SketchPoint[], azDeg: number): number | null {
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  if (azDeg <= first.azDeg) return first.elDeg;
  if (azDeg >= last.azDeg) return last.elDeg;
  for (let index = 1; index < sorted.length; index += 1) {
    const right = sorted[index];
    const left = sorted[index - 1];
    if (!right || !left) continue;
    if (azDeg <= right.azDeg) {
      const width = right.azDeg - left.azDeg;
      if (width <= 0) return right.elDeg;
      const t = (azDeg - left.azDeg) / width;
      return left.elDeg + t * (right.elDeg - left.elDeg);
    }
  }
  return last.elDeg;
}

/** Degrees wrapped into [0, 360). */
export function wrapAzimuth(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Clockwise width from `fromDeg` to `toDeg`, in degrees, wrapping at 0°/360°.
 * A span of 360° or more is the whole circle. A window that starts and ends on the
 * same degree, and was not a full turn, has width 0.
 */
export function clockwiseWidthDeg(fromDeg: number, toDeg: number): number {
  if (!Number.isFinite(fromDeg) || !Number.isFinite(toDeg)) return Number.NaN;
  if (Math.abs(toDeg - fromDeg) >= 360) return 360;
  const start = wrapAzimuth(fromDeg);
  const end = wrapAzimuth(toDeg);
  if (start === end) return 0;
  return end >= start ? end - start : 360 - start + end;
}

/** True when `azDeg` lies in the clockwise window from `fromDeg` to `toDeg`, inclusive. */
export function azimuthInWindow(azDeg: number, fromDeg: number, toDeg: number): boolean {
  if (!Number.isFinite(azDeg) || !Number.isFinite(fromDeg) || !Number.isFinite(toDeg)) return false;
  if (Math.abs(toDeg - fromDeg) >= 360) return true;
  const azimuth = wrapAzimuth(azDeg);
  const start = wrapAzimuth(fromDeg);
  const end = wrapAzimuth(toDeg);
  if (start === end) return azimuth === start;
  if (start < end) return azimuth >= start && azimuth <= end;
  return azimuth >= start || azimuth <= end;
}

/**
 * The gap: the mean absolute difference in degrees between the sketch and the real
 * skyline, over the real skyline's points inside the azimuth window.
 * The window may wrap past 0°/360°: pass a `fromDeg` that is greater than `toDeg`
 * after wrapping, or any pair whose clockwise span crosses north.
 * Returns NaN when the window is not finite or the sketch has no elevation to compare.
 * A finite window that contains no skyline sample throws: that is a lesson-definition
 * error, not a gap.
 */
export function skylineGapDeg(
  sketch: readonly SketchPoint[],
  real: readonly SketchPoint[],
  azFromDeg: number,
  azToDeg: number,
): number {
  if (!Number.isFinite(azFromDeg) || !Number.isFinite(azToDeg)) return Number.NaN;
  const sorted = [...sketch].sort((a, b) => a.azDeg - b.azDeg);
  let sum = 0;
  let count = 0;
  for (const point of real) {
    if (!azimuthInWindow(point.azDeg, azFromDeg, azToDeg)) continue;
    const drawn = sketchAt(sorted, point.azDeg);
    if (drawn === null || !Number.isFinite(drawn) || !Number.isFinite(point.elDeg)) return Number.NaN;
    sum += Math.abs(drawn - point.elDeg);
    count += 1;
  }
  if (count === 0) {
    throw new RangeError("A draw-skyline window contains no skyline sample. That is a lesson-definition error.");
  }
  return sum / count;
}

/**
 * The azimuth window `skylineGapDeg` should use, with placeholders filled.
 * A centred window is `centre` ± `halfWidthDeg`, wrapped into [0, 360).
 * When the wrapped start is greater than the wrapped end, the window crosses 0°.
 * A half-width of 180° or more is the whole circle, returned as 0° to 360°.
 * Returns null when a key is missing or a value is not a finite number of degrees.
 */
export function resolveSkylineWindow(
  window: AzimuthWindow,
  examples: WorkedExamples,
): { fromDeg: number; toDeg: number } | null {
  if (window.kind === "centred") {
    const centre = resolveDegrees(window.centre, examples);
    if (centre === null || !Number.isFinite(window.halfWidthDeg) || window.halfWidthDeg < 0) return null;
    if (window.halfWidthDeg * 2 >= 360) return { fromDeg: 0, toDeg: 360 };
    return {
      fromDeg: wrapAzimuth(centre - window.halfWidthDeg),
      toDeg: wrapAzimuth(centre + window.halfWidthDeg),
    };
  }
  const from = resolveDegrees(window.from, examples);
  const to = resolveDegrees(window.to, examples);
  if (from === null || to === null) return null;
  return { fromDeg: from, toDeg: to };
}
