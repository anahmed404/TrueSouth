import type { TimeGrid } from "../../contracts/generated.ts";
import { resolveValue, type WorkedExamples } from "./placeholders";
import type { GoalValue } from "./types";
import { FIXTURE_TIME_GRID, hourOnGrid } from "./utc";

/**
 * The inclusive hour indexes of a drag window: `halfHours` on either side of
 * `aroundUtc`, clamped to the time grid. A missing placeholder is reported.
 * Returns null when the centre is not an hour on the grid.
 */
export function resolveCentredHours(
  aroundUtc: GoalValue,
  halfHours: number,
  examples: WorkedExamples,
  grid: TimeGrid = FIXTURE_TIME_GRID,
): { fromIndex: number; toIndex: number } | { missing: string[] } | null {
  if (!Number.isInteger(halfHours) || halfHours < 0) return null;
  const resolved = resolveValue(aroundUtc, examples);
  if (resolved.value === null) return { missing: resolved.missing };
  if (typeof resolved.value !== "string") return null;
  const centre = hourOnGrid(grid, resolved.value);
  if (centre === null) return null;
  return {
    fromIndex: Math.max(0, centre - halfHours),
    toIndex: Math.min(grid.count - 1, centre + halfHours),
  };
}
