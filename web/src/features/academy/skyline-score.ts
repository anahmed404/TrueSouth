import { resolveDegrees, type WorkedExamples } from "./placeholders";
import type { GoalValue, SketchPoint } from "./types";

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

/**
 * The gap: the mean absolute difference in degrees between the sketch and the real
 * skyline, over the real skyline's points whose azimuth lies in [azFrom, azTo].
 * Returns NaN when there is no sketch or no real point in the range.
 */
export function skylineGapDeg(
  sketch: readonly SketchPoint[],
  real: readonly SketchPoint[],
  azFromDeg: number,
  azToDeg: number,
): number {
  const sorted = [...sketch].sort((a, b) => a.azDeg - b.azDeg);
  let sum = 0;
  let count = 0;
  for (const point of real) {
    if (point.azDeg < azFromDeg || point.azDeg > azToDeg) continue;
    const drawn = sketchAt(sorted, point.azDeg);
    if (drawn === null) return Number.NaN;
    sum += Math.abs(drawn - point.elDeg);
    count += 1;
  }
  return count === 0 ? Number.NaN : sum / count;
}

/**
 * The azimuth window `skylineGapDeg` should use, with placeholders filled.
 * Returns null when a key is missing or a value is not a finite number of degrees,
 * so the sketch cannot be checked yet.
 */
export function resolveSkylineWindow(
  azFrom: GoalValue,
  azTo: GoalValue,
  examples: WorkedExamples,
): { azFrom: number; azTo: number } | null {
  const from = resolveDegrees(azFrom, examples);
  const to = resolveDegrees(azTo, examples);
  if (from === null || to === null) return null;
  return { azFrom: from, azTo: to };
}
