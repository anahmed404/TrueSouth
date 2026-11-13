/**
 * "Next GO": the first landing day, at or after a given day, on which a site is GO.
 *
 * It reads the slip sweep's 00:00 UTC landings (`evaluationsAtUtcMidnight`, one entry per
 * day of the time grid, day 0 being the grid's first day) and decides nothing itself: the
 * statuses are the sweep's (docs/science.md §10 and §11). The Slip Planner's "next GO"
 * column and Mission Control's "Next GO" button both use this one function.
 */

import type { Status } from "./scoring.ts";

/** One day's result as the sweep gives it: null when the mission window does not fit. */
export type DayResult = { readonly status: Status } | null;

/**
 * The index of the first day at or after `fromDay` whose status is GO, or null when there
 * is none before the end of `result` (the end of the time grid).
 *
 * `fromDay` below 0 is read as 0; a non-integer is rounded up, so the search never looks
 * before the day it was asked to start from.
 */
export function nextGoDay(result: ArrayLike<DayResult>, fromDay: number): number | null {
  if (Number.isNaN(fromDay)) return null;
  const start = Math.max(0, Math.ceil(fromDay));
  for (let day = start; day < result.length; day++) {
    if (result[day]?.status === "GO") return day;
  }
  return null;
}

/** The first hour of a day of the time grid: day `d` lands at 00:00 UTC, hour `24 × d`. */
export function dayToHour(day: number): number {
  return day * 24;
}

/** The day of the time grid an hour falls on. */
export function hourToDay(hour: number): number {
  return Math.floor(hour / 24);
}
