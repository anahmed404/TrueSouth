/**
 * Compare's "Sites and dates" mode (docs/features/compare.md, "Sites and dates"): two sites
 * at two landing dates, four columns. The picks, their defaults, the column order, the best
 * column, the one-line summary and the `cmp` link parameter. No React here, and no scoring:
 * each column's result is `useSiteStatus` for its site and date, as everywhere else.
 */

import type { MissionProfile, TimeGrid } from "../../../contracts/generated";
import { formatUtc } from "../../../components/format";
import { clampLanding } from "../../../app/mission/landing-control";
import { scoreText } from "../../../app/mission/rules";
import type { Status } from "../../../lib/scoring";
import { failText, type ColumnView } from "./model";

export type CompareMode = "sites" | "dates";

/** The segmented control's labels: short, sentence case, the CONTEXT.md terms. */
export const MODE_LABELS: Readonly<Record<CompareMode, string>> = { sites: "Sites", dates: "Sites and dates" };

/** Two sites (A and B) and two landing dates (1 and 2), UTC, whole hours. */
export type DatesPicks = { siteA: string; siteB: string; date1: string; date2: string };

const DAY_MS = 86_400_000;

/**
 * The picks a planner starts from: A is the focused site (or the first selected), B the next
 * selected site after it, wrapping (or A again when only one site is selected: one site at
 * two dates). Date 1 is the scenario's landing date; date 2 is A's next GO day after it
 * (`nextGoUtc`, 00:00 UTC, as "Next GO" finds it), or date 1 plus 7 days when there is none.
 * Both dates are clamped to the landings whose mission window fits the data.
 */
export function defaultPicks(
  siteIds: readonly string[],
  focusedSiteId: string | null,
  landingUtc: string,
  nextGoUtc: string | null,
  grid: TimeGrid,
  durationDays: number,
): DatesPicks | null {
  if (siteIds.length === 0) return null;
  const siteA = focusedSiteId !== null && siteIds.includes(focusedSiteId) ? focusedSiteId : (siteIds[0] as string);
  const siteB = siteIds.length > 1 ? (siteIds[(siteIds.indexOf(siteA) + 1) % siteIds.length] as string) : siteA;
  const date1 = clampLanding(grid, durationDays, landingUtc) ?? landingUtc;
  const later = new Date(Date.parse(date1) + 7 * DAY_MS).toISOString();
  const date2 = clampLanding(grid, durationDays, nextGoUtc ?? later) ?? date1;
  return { siteA, siteB, date1, date2 };
}

/**
 * The picks in use: the user's, with any site that has left the selection replaced by its
 * default; the defaults when the user has not picked. `clamp` (the landing-date control's
 * own limit for the current mission) is applied to the user's dates again, so a change to a
 * longer mission cannot leave a picked date whose window runs past the data.
 */
export function resolvePicks(
  stored: DatesPicks | null,
  defaults: DatesPicks | null,
  siteIds: readonly string[],
  clamp: (utc: string) => string | null = (utc) => utc,
): DatesPicks | null {
  if (!defaults) return null;
  if (!stored) return defaults;
  return {
    siteA: siteIds.includes(stored.siteA) ? stored.siteA : defaults.siteA,
    siteB: siteIds.includes(stored.siteB) ? stored.siteB : defaults.siteB,
    date1: clamp(stored.date1) ?? defaults.date1,
    date2: clamp(stored.date2) ?? defaults.date2,
  };
}

export type DatesColumnSpec = { siteId: string; landingUtc: string; site: "A" | "B"; date: 1 | 2 };

/** The four columns, grouped by site: A on date 1, A on date 2, B on date 1, B on date 2. */
export function datesColumnSpecs(picks: DatesPicks): DatesColumnSpec[] {
  return [
    { siteId: picks.siteA, landingUtc: picks.date1, site: "A", date: 1 },
    { siteId: picks.siteA, landingUtc: picks.date2, site: "A", date: 2 },
    { siteId: picks.siteB, landingUtc: picks.date1, site: "B", date: 1 },
    { siteId: picks.siteB, landingUtc: picks.date2, site: "B", date: 2 },
  ];
}

const RANK: Readonly<Record<Status, number>> = { GO: 2, CAUTION: 1, "NO-GO": 0 };

/**
 * The best column: GO beats CAUTION beats NO-GO, then the higher score as printed. Every
 * column tied on both is best. None while a column is still loading, when fewer than two
 * have a result, when all tie, or when every column is NO-GO (a NO-GO score is not used).
 */
export function bestColumns(columns: readonly ColumnView[]): boolean[] {
  const none = columns.map(() => false);
  if (columns.some((c) => c.status.kind === "loading")) return none;
  const ranked = columns.map((c) => (c.evaluation ? { rank: RANK[c.evaluation.status], score: Number(scoreText(c.evaluation.score)) } : null));
  const ready = ranked.filter((r): r is { rank: number; score: number } => r !== null);
  if (ready.length < 2) return none;
  const topRank = Math.max(...ready.map((r) => r.rank));
  if (topRank === RANK["NO-GO"]) return none;
  const topScore = Math.max(...ready.filter((r) => r.rank === topRank).map((r) => r.score));
  const best = ranked.map((r) => r !== null && r.rank === topRank && r.score === topScore);
  if (best.filter(Boolean).length === ready.length) return none;
  return best;
}

/** "Connecting Ridge · 2028-01-27 00:00 UTC": a column's full name. */
export function columnLabel(column: Pick<ColumnView, "name" | "landingUtc">): string {
  return column.landingUtc ? `${column.name} · ${formatUtc(column.landingUtc)}` : column.name;
}

function resultWord(column: ColumnView): string {
  if (column.evaluation) return column.evaluation.status;
  if (column.status.kind === "loading") return "loading";
  if (column.status.kind === "error") return "not loaded";
  return "without a result";
}

/** One site's two columns in words: "Connecting Ridge is GO on both dates". */
function siteClause(first: ColumnView, second: ColumnView): string {
  const a = resultWord(first);
  const b = resultWord(second);
  if (a === b) return `${first.name} is ${a} on both dates`;
  return `${first.name} is ${a} on ${formatUtc(first.landingUtc ?? "")} and ${b} on ${formatUtc(second.landingUtc ?? "")}`;
}

/**
 * The four results in one or two sentences, for the table's accessible description: each
 * site on its two dates, then the best column (with why a NO-GO fails when nothing is GO).
 */
export function datesSummary(columns: readonly ColumnView[], profile: MissionProfile, best: readonly boolean[]): string {
  const who = profile.id === "custom" ? "a custom profile" : profile.name;
  const [a1, a2, b1, b2] = columns;
  if (!a1 || !a2 || !b1 || !b2) return "Pick two sites and two landing dates to compare.";
  const sameSite = a1.siteId === b1.siteId;
  const first = `For ${who}, ${sameSite ? siteClause(a1, a2) : `${siteClause(a1, a2)}; ${siteClause(b1, b2)}`}.`;
  if (columns.some((c) => c.status.kind === "loading")) return first;
  const winners = columns.filter((_, i) => best[i]);
  // With A and B the same site, the two pairs are the same columns: name each date once.
  const named = [...new Map(winners.map((c) => [`${c.siteId}@${c.landingUtc}`, c])).values()];
  if (named.length > 0) {
    const score = scoreText((named[0] as ColumnView).evaluation?.score ?? 0);
    const list = named.map((c) => `${c.name} on ${formatUtc(c.landingUtc ?? "")}`);
    const tie = list.length > 1 ? `, tied at ${score} of 100` : `, ${score} of 100`;
    return `${first} Best: ${list.join(" and ")}${tie}.`;
  }
  const scored = columns.filter((c) => c.evaluation);
  if (scored.length > 0 && scored.every((c) => c.evaluation?.status === "NO-GO")) {
    const firstFail = scored[0] as ColumnView;
    // "All four" only when all four have a result: a column that failed to load, or has no
    // result, is not a NO-GO.
    const all = scored.length === columns.length;
    const lead = all ? (sameSite ? "Both dates are NO-GO" : "All four are NO-GO") : "Every column with a result is NO-GO";
    return `${first} ${lead}; ${columnLabel(firstFail)} fails on ${failText(firstFail)}.`;
  }
  if (scored.length >= 2) return `${first} No column is better than another.`;
  return first;
}

// ── The share link's `cmp` parameter ────────────────────────────────────────

/** "2028-01-27T00:00:00Z" → "2028-01-27T00:00Z", as the link's `land` writes it. */
function linkTime(utc: string): string {
  return `${utc.slice(0, 16)}Z`;
}

/** `cmp=<site A>,<site B>,<date 1>,<date 2>`. */
export function writeCmp(picks: DatesPicks): string {
  return [picks.siteA, picks.siteB, linkTime(picks.date1), linkTime(picks.date2)].join(",");
}

/** A link time as a grid hour's UTC, or null when it is not a whole hour whose window fits. */
function readTime(raw: string, grid: TimeGrid, durationDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(raw)) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  const utc = new Date(ms).toISOString().replace(".000Z", "Z");
  const clamped = clampLanding(grid, durationDays, utc);
  return clamped === utc ? utc : null;
}

/**
 * The picks a link carries, or null to ignore it: both sites selected, both dates whole
 * hours of the grid whose mission window ends inside the data. Nothing is clamped: a link
 * that does not fit is ignored, and the Sites mode shows.
 */
export function readCmp(raw: string | null, siteIds: readonly string[], grid: TimeGrid, durationDays: number): DatesPicks | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 4) return null;
  const [siteA, siteB, d1, d2] = parts as [string, string, string, string];
  if (!siteIds.includes(siteA) || !siteIds.includes(siteB)) return null;
  const date1 = readTime(d1, grid, durationDays);
  const date2 = readTime(d2, grid, durationDays);
  if (!date1 || !date2) return null;
  return { siteA, siteB, date1, date2 };
}
