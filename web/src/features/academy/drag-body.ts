import type { TimeGrid } from "../../contracts/generated.ts";
import type { ChartSeries } from "../panorama/readings";
import { compareGoalValues } from "./evaluator";
import { resolveValue, type WorkedExamples } from "./placeholders";
import { resolveCentredHours } from "./time-range";
import type { GoalOp, TimeRange } from "./types";
import { FIXTURE_TIME_GRID, hourOnGrid, parseUtcHour } from "./utc";

/**
 * The drag-body step's logic, kept pure so it can be tested without a browser: which hours
 * the learner may drag through, which hour a pointer or a key picks, and what the series
 * says at that hour. Every value is read from the stored series. Nothing here works out
 * where the Sun or Earth is (docs/decisions/0002-scoring-in-browser.md).
 */

/** The story month: 720 stored hours from the story landing hour (docs/academy/lessons.md, "Time spans"). */
export const STORY_MONTH_HOURS = 720;

/** An inclusive span of hour indexes on the time grid. */
export type HourRange = { fromIndex: number; toIndex: number };

/**
 * The hours a drag-body step drags through.
 * - `utc`: the two instants, inclusive.
 * - `span` `one-month`: the story month (`storyMonth`), which must hold `aroundUtc`. `aroundUtc`
 *   must fall inside it; a lesson that names an hour outside the story month is an error.
 * - `hours`: `halfHours` on either side of `aroundUtc`, clamped to the grid.
 * Returns the missing keys while a placeholder has no value, and null for a range that is
 * not on the grid.
 */
export function resolveTimeRange(
  range: TimeRange,
  examples: WorkedExamples,
  grid: TimeGrid = FIXTURE_TIME_GRID,
): HourRange | { missing: string[] } | null {
  if (range.kind === "hours") return resolveCentredHours(range.aroundUtc, range.halfHours, examples, grid);
  if (range.kind === "utc") {
    const from = hourOnGrid(grid, range.fromUtc);
    const to = hourOnGrid(grid, range.toUtc);
    if (from === null || to === null || to < from) return null;
    return { fromIndex: from, toIndex: to };
  }
  const around = resolveValue(range.aroundUtc, examples);
  const month = storyMonth(examples, grid);
  if ("missing" in month || around.value === null) {
    return { missing: [...around.missing, ...("missing" in month ? month.missing : [])] };
  }
  if ("problem" in month || typeof around.value !== "string") return null;
  const centre = hourOnGrid(grid, around.value);
  if (centre === null || centre < month.fromIndex || centre > month.toIndex) return null;
  return month;
}

/**
 * The story month (docs/academy/lessons.md, "Time spans"): the 720 stored hours from
 * `story.landing_utc` to `story.month_end_utc`, exclusive. Both keys must agree: an end that
 * is not exactly 720 hours after the landing, or a month that does not fit inside the time
 * grid, is a data error, reported as a problem and never shortened or guessed.
 */
export function storyMonth(
  examples: WorkedExamples,
  grid: TimeGrid = FIXTURE_TIME_GRID,
): HourRange | { missing: string[] } | { problem: string } {
  const start = resolveValue("{{example.story.landing_utc}}", examples);
  const end = resolveValue("{{example.story.month_end_utc}}", examples);
  const missing = [...start.missing, ...end.missing];
  if (missing.length) return { missing };
  if (typeof start.value !== "string" || typeof end.value !== "string") return { problem: "the story month's ends are not UTC times" };
  const from = hourOnGrid(grid, start.value);
  const startMs = parseUtcHour(start.value);
  const endMs = parseUtcHour(end.value);
  if (from === null || startMs === null || endMs === null) return { problem: "the story month's ends are not hours on the time grid" };
  const hours = (endMs - startMs) / (grid.step_s * 1000);
  if (hours !== STORY_MONTH_HOURS) {
    return { problem: `story.month_end_utc is ${hours} hours after story.landing_utc, not ${STORY_MONTH_HOURS}` };
  }
  if (from + STORY_MONTH_HOURS > grid.count) return { problem: "the story month runs past the end of the time grid" };
  return { fromIndex: from, toIndex: from + STORY_MONTH_HOURS - 1 };
}

/** The number of hours in a range. */
export function hourCount(range: HourRange): number {
  return range.toIndex - range.fromIndex + 1;
}

export function clampHour(range: HourRange, hour: number): number {
  return Math.min(range.toIndex, Math.max(range.fromIndex, Math.round(hour)));
}

/**
 * The hour after a key press, or null for a key the drag does not use.
 * Left and right step one hour, with Shift one day (24 hours); Home and End go to the ends;
 * Page Up and Page Down also step a day. Up and Down are left to the page.
 */
export function hourAfterKey(range: HourRange, hour: number, key: string, shift: boolean): number | null {
  const stride = shift ? 24 : 1;
  switch (key) {
    case "ArrowLeft":
      return clampHour(range, hour - stride);
    case "ArrowRight":
      return clampHour(range, hour + stride);
    case "PageDown":
      return clampHour(range, hour - 24);
    case "PageUp":
      return clampHour(range, hour + 24);
    case "Home":
      return range.fromIndex;
    case "End":
      return range.toIndex;
    default:
      return null;
  }
}

/** The hour under a pointer on the time bar: the bar's width spans the range, snapped to an hour. */
export function hourAtBarX(range: HourRange, widthPx: number, px: number): number {
  if (!(widthPx > 0)) return range.fromIndex;
  const t = Math.min(1, Math.max(0, px / widthPx));
  return clampHour(range, range.fromIndex + t * (range.toIndex - range.fromIndex));
}

/** Where the time bar's knob sits for an hour, from 0 to `widthPx`. */
export function barXOfHour(range: HourRange, widthPx: number, hour: number): number {
  const span = range.toIndex - range.fromIndex;
  if (span <= 0) return 0;
  return ((clampHour(range, hour) - range.fromIndex) / span) * widthPx;
}

/** A body's place on the chart at one hour, in the chart's pixels. */
export type PathPoint = { hour: number; x: number; y: number };

/**
 * How strongly a drag prefers hours near the current one, in px² per hour². A month's Sun
 * path crosses itself near its ends and Earth's path folds back on itself, so the nearest
 * point alone could jump weeks; this keeps the drag moving along the path. It is small
 * enough that a pointer placed on another part of the path still goes there.
 */
export const CONTINUITY_PX2_PER_H2 = 0.02;

/**
 * The hour a pointer picks on the body's path: the stored hour whose disc is nearest the
 * pointer, with a small preference for hours near `current`. Snaps to a stored hour.
 */
export function hourNearPointer(
  points: readonly PathPoint[],
  px: number,
  py: number,
  current: number,
  continuity = CONTINUITY_PX2_PER_H2,
): number | null {
  let best: number | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const cost = (point.x - px) ** 2 + (point.y - py) ** 2 + continuity * (point.hour - current) ** 2;
    if (cost < bestCost) {
      bestCost = cost;
      best = point.hour;
    }
  }
  return best;
}

/** A goal metric and the series column it is read from. */
const METRIC_COLUMNS: Readonly<Record<string, keyof ChartSeries>> = {
  sun_el_deg: "sun_el",
  earth_el_deg: "earth_el",
  sun_frac: "sun_frac",
  earth_frac: "earth_frac",
};

export function metricColumn(metric: string): keyof ChartSeries | null {
  return METRIC_COLUMNS[metric] ?? null;
}

/** The goal metric's stored value at an hour: the attempt a drag-body step checks. */
export function metricAt(series: ChartSeries, metric: string, hour: number): number | null {
  const column = metricColumn(metric);
  if (!column) return null;
  const value = series[column][hour];
  return value !== undefined && Number.isFinite(value) ? value : null;
}

/** The largest and smallest stored value of a metric over a range, with the first hour of each. */
export function metricExtremes(
  series: ChartSeries,
  metric: string,
  range: HourRange,
): { max: number; maxHour: number; min: number; minHour: number } | null {
  let max = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  let maxHour = -1;
  let minHour = -1;
  for (let hour = range.fromIndex; hour <= range.toIndex; hour += 1) {
    const value = metricAt(series, metric, hour);
    if (value === null) continue;
    if (value > max) {
      max = value;
      maxHour = hour;
    }
    if (value < min) {
      min = value;
      minHour = hour;
    }
  }
  return maxHour < 0 ? null : { max, maxHour, min, minHour };
}

/** A goal with its placeholders filled, on numbers, with its optional second condition. */
export type NumberGoal = {
  metric: string;
  op: GoalOp;
  value: number;
  tolerance?: number;
  also?: { metric: string; op: GoalOp; value: number };
};

/** Each goal metric's stored value at an hour (the attempt's `values`), or null when one is missing. */
export function goalValuesAt(series: ChartSeries, goal: NumberGoal, hour: number): Record<string, number> | null {
  const values: Record<string, number> = {};
  for (const metric of goal.also ? [goal.metric, goal.also.metric] : [goal.metric]) {
    const value = metricAt(series, metric, hour);
    if (value === null) return null;
    values[metric] = value;
  }
  return values;
}

export function meetsAt(series: ChartSeries, goal: NumberGoal, hour: number): boolean {
  const value = metricAt(series, goal.metric, hour);
  if (value === null || !compareGoalValues(value, goal.op, goal.value, goal.tolerance)) return false;
  if (!goal.also) return true;
  const also = metricAt(series, goal.also.metric, hour);
  return also !== null && compareGoalValues(also, goal.also.op, goal.also.value);
}

/**
 * Where the body starts: the middle of the range, else its end, else its start, whichever
 * does not already meet the goal, so the learner has something to find.
 */
export function startHour(series: ChartSeries | null, goal: NumberGoal | null, range: HourRange): number {
  const middle = clampHour(range, (range.fromIndex + range.toIndex) / 2);
  if (!series || !goal) return middle;
  for (const hour of [middle, range.toIndex, range.fromIndex]) if (!meetsAt(series, goal, hour)) return hour;
  return middle;
}

/**
 * The hour the answer is marked at, after a right answer or a shown one. For an `==` goal
 * (such as the month's highest Sun) it is the first hour that meets it; for any other it is
 * the hour meeting the goal nearest the middle of the range. Null when no hour does.
 */
export function answerHour(series: ChartSeries, goal: NumberGoal, range: HourRange): number | null {
  if (goal.op === "==") {
    for (let hour = range.fromIndex; hour <= range.toIndex; hour += 1) if (meetsAt(series, goal, hour)) return hour;
    return null;
  }
  const middle = (range.fromIndex + range.toIndex) / 2;
  let best: number | null = null;
  for (let hour = range.fromIndex; hour <= range.toIndex; hour += 1) {
    if (!meetsAt(series, goal, hour)) continue;
    if (best === null || Math.abs(hour - middle) < Math.abs(best - middle)) best = hour;
  }
  return best;
}
