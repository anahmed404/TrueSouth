import type { TimeGrid } from "../../contracts/generated.ts";

function assertGrid(grid: TimeGrid): void {
  if (!Number.isInteger(grid.count) || grid.count < 0) {
    throw new RangeError("time grid count must be a non-negative integer");
  }
  if (!Number.isFinite(grid.step_s) || grid.step_s <= 0) {
    throw new RangeError("time grid step_s must be positive");
  }
}

function parseUtcMs(utc: string): number {
  if (!utc.endsWith("Z")) {
    throw new RangeError(`${utc} must be a UTC timestamp ending in Z`);
  }
  const ms = Date.parse(utc);
  if (Number.isNaN(ms)) {
    throw new RangeError(`${utc} is not a UTC timestamp`);
  }
  return ms;
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/\.000Z$/, "Z");
}

function stepMs(grid: TimeGrid): number {
  const ms = grid.step_s * 1000;
  if (!Number.isInteger(ms)) {
    throw new RangeError("time grid step_s must be a whole number of milliseconds");
  }
  return ms;
}

/** Hour 0 is `time_grid.start_utc`. The result is UTC and ends in Z. */
export function hourIndexToUtc(grid: TimeGrid, index: number): string {
  assertGrid(grid);
  if (!Number.isInteger(index) || index < 0 || index >= grid.count) {
    throw new RangeError(`hour index ${index} is outside the time grid of ${grid.count} hours`);
  }
  return formatUtc(parseUtcMs(grid.start_utc) + index * stepMs(grid));
}

/** The hour index of a UTC timestamp on the grid. Off-grid times throw. */
export function utcToHourIndex(grid: TimeGrid, utc: string): number {
  assertGrid(grid);
  const delta = parseUtcMs(utc) - parseUtcMs(grid.start_utc);
  const step = stepMs(grid);
  if (delta < 0 || delta % step !== 0) {
    throw new RangeError(`${utc} is outside the time grid`);
  }
  const index = delta / step;
  if (index >= grid.count) {
    throw new RangeError(`${utc} is outside the time grid`);
  }
  return index;
}
