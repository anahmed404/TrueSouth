/**
 * The words and states of the landing-date control and its "Next GO" button, kept free of
 * React so they can be tested on their own (docs/features/site-detail.md, "The landing
 * date"). Statuses come from the slip sweep through `nextGoDay`; nothing here scores.
 */

import { formatUtc } from "../../components/format";
import type { TimeGrid } from "../../contracts/generated";
import type { HookResult } from "../../data/hooks";
import { dayToHour, hourToDay, nextGoDay, windowLength, type DayResult } from "../../lib/scoring";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { lastLandingHour } from "../../state/scenario";
import { formatLimit } from "./rules";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2028-03-14T00:00:00Z" → "14 Mar 2028". */
export function dayText(utc: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(utc);
  if (!match) return utc;
  return `${match[3]} ${MONTHS[Number(match[2]) - 1] ?? ""} ${match[1]}`;
}

/**
 * The end of the mission window that starts at `landingUtc`: the landing plus the window's
 * hours (docs/science.md §9), the first hour after the window, as the timeline draws it.
 * `day` carries the year only when it differs from the landing's.
 */
export function windowEnd(landingUtc: string, durationDays: number): { utc: string; day: string; time: string; long: string } | null {
  const start = Date.parse(landingUtc);
  if (Number.isNaN(start)) return null;
  const utc = new Date(start + windowLength(durationDays) * 3_600_000).toISOString().replace(".000Z", "Z");
  const long = dayText(utc);
  const sameYear = utc.slice(0, 4) === landingUtc.slice(0, 4);
  const time = utc.slice(11, 16);
  return { utc, day: sameYear ? long.slice(0, -5) : long, time, long: `${long} ${time} UTC` };
}

/**
 * Why the day and slip buttons do nothing at the ends of the time grid, with the real dates:
 * the grid's first hour, and the last landing whose window still ends inside the data.
 */
export function endReasons(grid: TimeGrid, durationDays: number, lastLandingHour: number): { first: string; last: string } {
  const first = formatUtc(hourIndexToUtc(grid, 0));
  const last = formatUtc(hourIndexToUtc(grid, Math.max(0, lastLandingHour)));
  return {
    first: `The data starts at ${first}, so the landing cannot be earlier.`,
    last: `A ${formatLimit(durationDays, "d")} mission cannot land later than ${last}: its window must end inside the data.`,
  };
}

/** The first year after the time grid ends: 2032 for the six-year grid from 2026. */
export function gridEndYear(grid: TimeGrid): number {
  const endMs = Date.parse(grid.start_utc) + grid.count * grid.step_s * 1000;
  return new Date(endMs - 1).getUTCFullYear() + 1;
}

export function noGoText(grid: TimeGrid): string {
  return `No later GO before ${gridEndYear(grid)}`;
}

export function movedText(toUtc: string, siteName: string): string {
  return `Landing moved to ${dayText(toUtc)}, the next GO date for ${siteName}.`;
}

export function undoneText(fromUtc: string): string {
  return `Landing moved back to ${dayText(fromUtc)}.`;
}

/** What the "Next GO" button shows. */
export type NextGoView =
  /** No focused site: the button is not shown. */
  | { kind: "hidden" }
  /** The sweep is still running: the button shows it is working and cannot be pressed. */
  | { kind: "working"; description: string }
  | { kind: "error"; description: string }
  /** No later GO in the time grid: a plain line instead of a button. */
  | { kind: "none"; text: string; description: string }
  | { kind: "ready"; targetUtc: string; description: string };

export type NextGoInput = {
  siteId: string | null;
  siteName: string;
  /** The sweep's 00:00 UTC landings for the focused site, one per day of the time grid. */
  days: HookResult<ArrayLike<DayResult>>;
  landingUtc: string;
  grid: TimeGrid;
};

/** The day after the landing date's day: "Next GO" never stays on the current day. */
export function searchFromDay(grid: TimeGrid, landingUtc: string): number {
  return hourToDay(utcToHourIndex(grid, landingUtc)) + 1;
}

export function nextGoView({ siteId, siteName, days, landingUtc, grid }: NextGoInput): NextGoView {
  if (!siteId) return { kind: "hidden" };
  if (days.status === "loading") {
    return { kind: "working", description: `Working out the GO dates for ${siteName}…` };
  }
  if (days.status === "error") {
    return { kind: "error", description: `The GO dates for ${siteName} could not be worked out: ${days.error}` };
  }
  let from: number;
  try {
    from = searchFromDay(grid, landingUtc);
  } catch {
    return { kind: "error", description: "The landing date is outside the time grid." };
  }
  const day = nextGoDay(days.data, from);
  if (day === null) {
    return {
      kind: "none",
      text: noGoText(grid),
      description: `${siteName} has no GO landing day after this landing date for this mission profile, up to the end of the data.`,
    };
  }
  const targetUtc = hourIndexToUtc(grid, dayToHour(day));
  return {
    kind: "ready",
    targetUtc,
    description: `Moves the landing to 00:00 UTC on ${dayText(targetUtc)}, the next day ${siteName} is GO for this mission profile. Each day is checked as a landing at 00:00 UTC.`,
  };
}

/**
 * A landing date as the scenario would take it (`setLandingDate`): a whole hour of the time
 * grid, no earlier than its first hour and no later than the last landing whose mission
 * window ends inside the data. Null for text that is not a time. Used where a landing date
 * is picked without moving the scenario's (Compare's "Sites and dates").
 */
export function clampLanding(grid: TimeGrid, durationDays: number, utc: string): string | null {
  const ms = Date.parse(utc);
  if (Number.isNaN(ms)) return null;
  let hour: number;
  try {
    hour = utcToHourIndex(grid, utc);
  } catch {
    hour = ms < Date.parse(grid.start_utc) ? 0 : Number.MAX_SAFE_INTEGER;
  }
  return hourIndexToUtc(grid, Math.min(Math.max(hour, 0), lastLandingHour(grid, durationDays)));
}
