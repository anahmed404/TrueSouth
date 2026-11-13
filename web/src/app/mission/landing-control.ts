/**
 * The words and states of the landing-date control and its "Next GO" button, kept free of
 * React so they can be tested on their own (docs/features/site-detail.md, "The landing
 * date"). Statuses come from the slip sweep through `nextGoDay`; nothing here scores.
 */

import type { TimeGrid } from "../../contracts/generated";
import type { HookResult } from "../../data/hooks";
import { dayToHour, hourToDay, nextGoDay, type DayResult } from "../../lib/scoring";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2028-03-14T00:00:00Z" → "14 Mar 2028". */
export function dayText(utc: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(utc);
  if (!match) return utc;
  return `${match[3]} ${MONTHS[Number(match[2]) - 1] ?? ""} ${match[1]}`;
}

/** The first year after the time grid ends: 2032 for the six-year grid from 2026. */
export function gridEndYear(grid: TimeGrid): number {
  const endMs = Date.parse(grid.start_utc) + grid.count * grid.step_s * 1000;
  return new Date(endMs - 1).getUTCFullYear() + 1;
}

export function noGoText(grid: TimeGrid): string {
  return `No GO date before ${gridEndYear(grid)}`;
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
