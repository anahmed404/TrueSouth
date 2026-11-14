/**
 * "Next GO" as the Slip Planner shows it (docs/features/slip-planner.md, "The right-hand
 * column"). The search itself is the shared `nextGoDay` (lib/scoring/next-go.ts), the one the
 * shell's "Next GO" button uses; this file reads it over the packed per-day table and words
 * the answer.
 */

import type { Status } from "../../../lib/scoring";
import { nextGoDay, type DayResult } from "../../../lib/scoring/next-go";
import { codeStatus, type SlipDays } from "../../../lib/scoring/slip-days";

const RESULT: Readonly<Record<Status, DayResult>> = {
  GO: { status: "GO" },
  CAUTION: { status: "CAUTION" },
  "NO-GO": { status: "NO-GO" },
};

const results = new WeakMap<Uint8Array, ReadonlyArray<DayResult>>();

/** The packed status codes as `nextGoDay` reads them, worked out once per table. */
function dayResults(status: Uint8Array): ReadonlyArray<DayResult> {
  let list = results.get(status);
  if (!list) {
    list = Array.from(status, (code) => {
      const s = codeStatus(code);
      return s === null ? null : RESULT[s];
    });
    results.set(status, list);
  }
  return list;
}

/** The first landing day at or after `fromDay` that is GO for this site, or null. */
export function nextGo(days: Pick<SlipDays, "status">, fromDay: number): number | null {
  return nextGoDay(dayResults(days.status), fromDay);
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
