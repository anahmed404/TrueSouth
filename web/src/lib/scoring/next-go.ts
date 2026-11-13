/**
 * "Next GO": the first landing day, at or after a day, whose status is GO
 * (docs/features/slip-planner.md, "The right-hand column"). Shared by the Slip Planner's
 * "next GO" column and the shell's "Next GO" button.
 */

import { DAY_GO, type SlipDays } from "./slip-days.ts";

/**
 * The first day index at or after `fromDay` whose sweep status is GO, or null. `result` is a
 * site's per-day sweep result (`slipDays`, `cachedSlipDays`); day `d` is the landing at
 * 00:00 UTC, `d` days after the time grid's start.
 */
export function nextGoDay(result: Pick<SlipDays, "status">, fromDay: number): number | null {
  const status = result.status;
  for (let day = Math.max(0, Math.ceil(fromDay)); day < status.length; day += 1) {
    if (status[day] === DAY_GO) return day;
  }
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

/** "22 Mar", the UTC date of day `day` of a time grid that starts at `gridStartMs`. */
export function shortDay(gridStartMs: number, day: number): string {
  const date = new Date(gridStartMs + day * DAY_MS);
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()] ?? ""}`;
}

/**
 * The words for a site's next GO, seen from the landing day `fromDay`:
 * "GO on this date", "next GO 22 Mar" (with the year when it is another year:
 * "next GO 04 Jan 2029"), or "no GO before 2032" when the time grid holds no later GO.
 * `gridEndYear` is the time grid's last year (2031).
 */
export function nextGoWords(next: number | null, fromDay: number, gridStartMs: number, gridEndYear: number): string {
  if (next === null) return `no GO before ${gridEndYear + 1}`;
  if (next === fromDay) return "GO on this date";
  const year = new Date(gridStartMs + next * DAY_MS).getUTCFullYear();
  const fromYear = new Date(gridStartMs + fromDay * DAY_MS).getUTCFullYear();
  return `next GO ${shortDay(gridStartMs, next)}${year === fromYear ? "" : ` ${year}`}`;
}
