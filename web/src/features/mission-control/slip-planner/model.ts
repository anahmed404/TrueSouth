/**
 * The Slip Planner's logic without React or the DOM (docs/features/slip-planner.md). Every
 * status here is read from the slip sweep (lib/scoring): nothing in this file decides one.
 */

import type { Site } from "../../../contracts/generated";
import type { Evaluation, Status } from "../../../lib/scoring";
import { DAY_CAUTION, DAY_GO, DAY_NOGO, DAY_NONE, codeStatus, type SlipDays } from "../../../lib/scoring/slip-days";
import { shortDay } from "./next-go-words";

/** A strip mark for a day not yet worked out: it pulses grey. */
export const DAY_PENDING = 255;

const DAY_MS = 86_400_000;

/** A status's rank: GO beats CAUTION beats NO-GO beats no data. */
export function rank(code: number): number {
  if (code === DAY_GO) return 3;
  if (code === DAY_CAUTION) return 2;
  if (code === DAY_NOGO) return 1;
  return 0;
}

/**
 * "Any site": on each day, the best status among the selected sites (slip-planner.md, "The
 * landing-date panel"). A site not yet worked out (null) leaves the day pending, unless
 * another site is already GO that day.
 */
export function anySiteDays(sites: readonly (Pick<SlipDays, "status"> | null)[], dayCount: number): Uint8Array {
  const out = new Uint8Array(dayCount);
  for (let day = 0; day < dayCount; day += 1) {
    let best = 0;
    let pending = false;
    for (const site of sites) {
      if (!site) {
        pending = true;
        continue;
      }
      const r = rank(site.status[day] ?? DAY_NONE);
      if (r > best) best = r;
    }
    if (pending && best < 3) out[day] = DAY_PENDING;
    else out[day] = best === 3 ? DAY_GO : best === 2 ? DAY_CAUTION : best === 1 ? DAY_NOGO : DAY_NONE;
  }
  return out;
}

/**
 * Where a day's mark sits in a strip `height` px tall (slip-planner.md, "One strip per
 * selected site"): status by height as well as colour. GO full height, CAUTION half, NO-GO
 * a 2.4 px line at the foot, no data a faint 1 px line through the middle, and a day not
 * worked out yet the full height, in grey.
 */
export function markRect(code: number, height: number): { y: number; h: number } {
  if (code === DAY_GO || code === DAY_PENDING) return { y: 0, h: height };
  if (code === DAY_CAUTION) return { y: height / 2, h: height / 2 };
  if (code === DAY_NOGO) return { y: height - 2.4, h: 2.4 };
  return { y: height / 2 - 0.5, h: 1 };
}

/** Strip height and gap: 14 and 7 px; 12 and 5 with seven or eight sites; 18 with one. */
export function stripMetrics(siteCount: number, phone: boolean): { height: number; gap: number } {
  if (phone) return siteCount >= 7 ? { height: 10, gap: 4 } : siteCount === 1 ? { height: 18, gap: 4 } : { height: 12, gap: 4 };
  if (siteCount >= 7) return { height: 12, gap: 5 };
  if (siteCount === 1) return { height: 18, gap: 7 };
  return { height: 14, gap: 7 };
}

// ── Days, the visible range and the zoom ─────────────────────────────────────

export type Zoom = "3m" | "18m" | "6y";

export const ZOOMS: readonly { value: Zoom; label: string; days: number | null }[] = [
  { value: "3m", label: "3 months", days: 91 },
  { value: "18m", label: "18 months", days: 548 },
  { value: "6y", label: "6 years", days: null },
];

export function zoomDays(zoom: Zoom, dayCount: number): number {
  const days = ZOOMS.find((z) => z.value === zoom)?.days ?? null;
  return days === null ? dayCount : Math.min(days, dayCount);
}

/** The landing day: the day the landing hour falls on. The slider sits on it. */
export function dayOfHour(hour: number): number {
  return Math.floor(hour / 24);
}

/** The whole-days rule: a strip mark is a landing at 00:00 UTC. */
export function isWholeDay(hour: number): boolean {
  return hour % 24 === 0;
}

/**
 * The first visible day. The visible range follows the landing day: when it comes within 4 %
 * of the left edge or past 86 % of the width, the range moves so it sits a quarter of the way
 * in. `start` is the current first day, or null to place it afresh.
 */
export function followStart(start: number | null, span: number, day: number, dayCount: number): number {
  const max = Math.max(0, dayCount - span);
  if (span >= dayCount) return 0;
  const fresh = Math.min(max, Math.max(0, day - Math.round(span * 0.25)));
  if (start === null) return fresh;
  if (day < start + span * 0.04 || day > start + span * 0.86) return fresh;
  return Math.min(max, Math.max(0, start));
}

/** Scroll pans by 8 % of the visible span. */
export function panStart(start: number, span: number, direction: number, dayCount: number): number {
  const max = Math.max(0, dayCount - span);
  return Math.min(max, Math.max(0, start + Math.sign(direction) * Math.max(1, Math.round(span * 0.08))));
}

/** The day under a pointer `x` px into a strip `width` px wide. */
export function dayAtX(x: number, width: number, start: number, span: number): number {
  if (width <= 0) return start;
  return start + Math.floor((x / width) * span);
}

/** The last day whose mission window fits on the time grid. */
export function lastLandingDay(hourCount: number, windowHours: number): number {
  return Math.max(0, Math.floor((hourCount - windowHours) / 24));
}

/**
 * The slider's keys (slip-planner.md, "Keyboard use"): ← and → one day, Shift with an arrow
 * one week, Page Up and Page Down 30 days, Home and End the ends of the time grid, limited
 * by the mission duration. Returns the new day, or null for a key it does not take.
 */
export function sliderKey(key: string, shift: boolean, day: number, lastDay: number): number | null {
  let next: number;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      next = day - (shift ? 7 : 1);
      break;
    case "ArrowRight":
    case "ArrowUp":
      next = day + (shift ? 7 : 1);
      break;
    case "PageDown":
      next = day - 30;
      break;
    case "PageUp":
      next = day + 30;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = lastDay;
      break;
    default:
      return null;
  }
  return Math.min(lastDay, Math.max(0, next));
}

/** A strip's reading point: ← and → a day (Shift a week), Page Up and Down 30 days. */
export function stripKey(key: string, shift: boolean, day: number, lastDay: number): number | null {
  if (key === "Home" || key === "End" || key === "ArrowUp" || key === "ArrowDown") return null;
  return sliderKey(key, shift, day, lastDay);
}

/** "01 Mar 2028". */
export function dayLabel(gridStartMs: number, day: number): string {
  return `${shortDay(gridStartMs, day)} ${new Date(gridStartMs + day * DAY_MS).getUTCFullYear()}`;
}

/** The ISO-8601 UTC landing for a day: 00:00 UTC. */
export function dayUtc(gridStartMs: number, day: number): string {
  return new Date(gridStartMs + day * DAY_MS).toISOString().replace(".000Z", "Z");
}

// ── Sites, results and the comparison ─────────────────────────────────────

/**
 * One site's result for a landing: an evaluation, no data (window off the grid), not yet
 * known, or failed (its data or its sweep could not be computed).
 */
export type SiteResult = { kind: "ready"; evaluation: Evaluation } | { kind: "none" } | { kind: "pending" } | { kind: "failed" };

export function resultStatus(result: SiteResult): Status | null {
  return result.kind === "ready" ? result.evaluation.status : null;
}

/** The best site on a date: GO before CAUTION, then the higher score. NO-GO is never best. */
export function bestSite(results: readonly { siteId: string; result: SiteResult }[]): { siteId: string; evaluation: Evaluation } | null {
  let best: { siteId: string; evaluation: Evaluation } | null = null;
  for (const { siteId, result } of results) {
    if (result.kind !== "ready" || result.evaluation.status === "NO-GO") continue;
    const e = result.evaluation;
    if (!best) {
      best = { siteId, evaluation: e };
      continue;
    }
    const a = rank(statusCodeOf(e.status));
    const b = rank(statusCodeOf(best.evaluation.status));
    if (a > b || (a === b && e.score > best.evaluation.score)) best = { siteId, evaluation: e };
  }
  return best;
}

function statusCodeOf(status: Status): number {
  return status === "GO" ? DAY_GO : status === "CAUTION" ? DAY_CAUTION : DAY_NOGO;
}

/** Did a site's status change between two landings? Unknown results never count as a change. */
export function changed(before: SiteResult, after: SiteResult): boolean {
  const unknown = (r: SiteResult) => r.kind === "pending" || r.kind === "failed";
  if (unknown(before) || unknown(after)) return false;
  return resultStatus(before) !== resultStatus(after);
}

/** "+21 d", "−3 d" (a true minus sign). */
export function signedDays(days: number): string {
  return days >= 0 ? `+${days} d` : `−${Math.abs(days)} d`;
}

/**
 * The before-and-after line (slip-planner.md, "Before and after a slip"): "Slipped +21 d,
 * 01 Mar → 22 Mar 2028. 4 of 5 sites changed. Best now: Mons Mouton, GO, score 99 (was
 * Malapert Massif)." Null until every site's result is known, so no line is ever half true.
 * A site that could not be computed is left out, and the line says so.
 */
export function slipSummary(args: {
  fromHour: number;
  toHour: number;
  gridStartMs: number;
  sites: readonly { siteId: string; name: string; before: SiteResult; after: SiteResult }[];
  scoreText: (score: number) => string;
}): string | null {
  const { fromHour, toHour, gridStartMs } = args;
  if (args.sites.some((s) => s.before.kind === "pending" || s.after.kind === "pending")) return null;
  const sites = args.sites.filter((s) => s.before.kind !== "failed" && s.after.kind !== "failed");
  const missing = args.sites.length - sites.length;
  const missingText = missing === 0 ? "" : ` ${missing} ${missing === 1 ? "site" : "sites"} could not be computed.`;
  const days = Math.round((toHour - fromHour) / 24);
  const fromDay = dayOfHour(fromHour);
  const toDay = dayOfHour(toHour);
  const fromYear = new Date(gridStartMs + fromDay * DAY_MS).getUTCFullYear();
  const toYear = new Date(gridStartMs + toDay * DAY_MS).getUTCFullYear();
  const from = fromYear === toYear ? shortDay(gridStartMs, fromDay) : dayLabel(gridStartMs, fromDay);
  const dates = `${from} → ${dayLabel(gridStartMs, toDay)}`;
  const count = sites.filter((s) => changed(s.before, s.after)).length;
  const total = sites.length;
  const changedText =
    total === 1 ? (count === 1 ? "The site changed." : "The site did not change.") : `${count} of ${total} sites changed.`;
  const nameOf = (id: string) => sites.find((s) => s.siteId === id)?.name ?? id;
  const now = bestSite(sites.map((s) => ({ siteId: s.siteId, result: s.after })));
  const was = bestSite(sites.map((s) => ({ siteId: s.siteId, result: s.before })));
  let best: string;
  if (!now) best = "No site is GO or CAUTION on this date.";
  else {
    const wasText = was && was.siteId !== now.siteId ? ` (was ${nameOf(was.siteId)})` : "";
    best = `Best now: ${nameOf(now.siteId)}, ${now.evaluation.status}, score ${args.scoreText(now.evaluation.score)}${wasText}.`;
  }
  return `Slipped ${signedDays(days)}, ${dates}. ${changedText} ${best}${missingText}`;
}

/** Spot priority for close sites: the focused site, then the best, changed, listed, variants. */
export function spotPriority(args: { focused: boolean; best: boolean; changed: boolean; variant: boolean }): number {
  return (args.focused ? 8 : 0) + (args.best ? 4 : 0) + (args.changed ? 2 : 0) + (args.variant ? 0 : 1);
}

/** A best-lit variant: chosen by TrueSouth near a sunlit-peak site (decision 0012). */
export function variantOf(site: Site): string | null {
  const value = (site as Site & { variant_of?: string | null }).variant_of;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Metres between two sites, on the reference sphere. */
export function metresApart(a: Pick<Site, "lat_deg" | "lon_deg">, b: Pick<Site, "lat_deg" | "lon_deg">, radiusM: number): number {
  const r = Math.PI / 180;
  const p1 = a.lat_deg * r;
  const p2 = b.lat_deg * r;
  const dp = p2 - p1;
  const dl = (b.lon_deg - a.lon_deg) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * radiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Best-lit variant, 149 m from Connecting Ridge". */
export function variantLine(metres: number, parentName: string): string {
  return `Best-lit variant, ${Math.round(metres)} m from ${parentName}`;
}

/** Where an off-view site is, for its note: "near the equator", "at 69°S". */
export function offViewWhere(latDeg: number): string {
  if (Math.abs(latDeg) < 30) return "near the equator";
  const hemisphere = latDeg < 0 ? "S" : "N";
  return `at ${Math.round(Math.abs(latDeg))}°${hemisphere}`;
}

export { codeStatus };
