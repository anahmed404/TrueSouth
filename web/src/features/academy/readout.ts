import { resolveDegrees, type WorkedExamples } from "./placeholders";
import type { GoalValue, NumberReadout } from "./types";

/**
 * How far the round Moon drops away, in metres: distance² / 2R.
 * `distanceKm` is the ground distance. `radiusM` is the Moon's radius in metres,
 * the same constant as `MOON_RADIUS_M` (docs/science.md §4).
 */
export function curvatureDropMetres(distanceKm: number, radiusM: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  if (!Number.isFinite(radiusM) || radiusM <= 0) return null;
  const distanceM = distanceKm * 1000;
  return (distanceM * distanceM) / (2 * radiusM);
}

/** Straight lines through the knots. Outside the first and last knot, the value stays at that end. */
export function piecewiseLinear(at: number, knots: readonly { at: number; value: number }[]): number | null {
  if (!Number.isFinite(at) || knots.length === 0) return null;
  const sorted = [...knots].sort((left, right) => left.at - right.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  if (!sorted.every((knot) => Number.isFinite(knot.at) && Number.isFinite(knot.value))) return null;
  if (at <= first.at) return first.value;
  if (at >= last.at) return last.value;
  for (let index = 1; index < sorted.length; index += 1) {
    const right = sorted[index];
    const left = sorted[index - 1];
    if (!right || !left) continue;
    if (at <= right.at) {
      const width = right.at - left.at;
      if (width === 0) return right.value;
      const t = (at - left.at) / width;
      return left.value + t * (right.value - left.value);
    }
  }
  return last.value;
}

function knotNumber(value: GoalValue, examples: WorkedExamples): number | null {
  return resolveDegrees(value, examples);
}

/**
 * The number (or stop text) a slider readout shows at `at`.
 * A missing worked-example knot returns null. It does not throw and it does not invent a number.
 */
export function numberReadoutAt(readout: NumberReadout, at: number, examples: WorkedExamples = {}): number | string | null {
  if (readout.kind === "stops") {
    return readout.stops.find((stop) => stop.at === at)?.text ?? null;
  }
  if (readout.kind === "curvature-drop") return curvatureDropMetres(at, readout.radiusM);
  const knots: { at: number; value: number }[] = [];
  for (const knot of readout.knots) {
    const x = knotNumber(knot.at, examples);
    const y = knotNumber(knot.value, examples);
    if (x === null || y === null) return null;
    knots.push({ at: x, value: y });
  }
  return piecewiseLinear(at, knots);
}
