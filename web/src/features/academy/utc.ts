import type { TimeGrid } from "../../contracts/generated.ts";

/**
 * The fixture time grid (`data/fixtures/manifest.json`). `validate.test.ts` fails if
 * these three numbers drift from that file. Dates in a lesson are counted as hours
 * on this grid.
 */
export const FIXTURE_TIME_GRID: TimeGrid = {
  start_utc: "2026-01-01T00:00:00Z",
  step_s: 3600,
  count: 52584,
};

/**
 * A UTC instant on the hour, ISO-8601, ending in `Z`.
 * Accepts `2026-01-01T00:00:00Z`, the same hour written `2026-01-01T00:00:00.000Z`,
 * and the short form `2026-01-01T00:00Z`.
 * Rejects a missing `Z`, an offset, a minute or second that is not zero, and a day
 * that is not on the calendar. Returns the instant in milliseconds, or null.
 */
export function parseUtcHour(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00(?::00(?:\.000)?)?Z$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  if (month < 1 || month > 12 || hour > 23) return null;
  const ms = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour
  ) {
    return null;
  }
  return ms;
}

/** The hour index of a UTC instant on `grid`, or null when it is not one of the grid's hours. */
export function hourOnGrid(grid: TimeGrid, utc: string): number | null {
  const ms = parseUtcHour(utc);
  const start = parseUtcHour(grid.start_utc);
  if (ms === null || start === null) return null;
  if (!Number.isInteger(grid.count) || grid.count < 0) return null;
  if (!Number.isFinite(grid.step_s) || grid.step_s <= 0) return null;
  const stepMs = grid.step_s * 1000;
  if (!Number.isInteger(stepMs) || stepMs <= 0) return null;
  const delta = ms - start;
  if (delta % stepMs !== 0) return null;
  const index = delta / stepMs;
  if (index < 0 || index >= grid.count) return null;
  return index;
}

/**
 * Compares two UTC hours by their index on the time grid.
 * The same hour written with or without `.000` compares equal. A string that is
 * not an on-grid hour does not compare.
 */
export function compareUtcHours(actual: string, op: "<" | "<=" | ">" | ">=" | "==", expected: string, grid: TimeGrid = FIXTURE_TIME_GRID): boolean {
  const left = hourOnGrid(grid, actual);
  const right = hourOnGrid(grid, expected);
  if (left === null || right === null) return false;
  switch (op) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "==":
      return left === right;
  }
}
