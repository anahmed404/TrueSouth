/**
 * The validation page's model: turns `validation.json` into what the page shows.
 *
 * Display only. Every number here is a value from the file, or a display value derived
 * from values in the file (a difference of two of its numbers, a count of its rows, the
 * largest of its numbers). Nothing is measured or computed afresh: the science behind
 * these numbers runs in Python (`uv run truesouth validate`).
 */
import type { Comparison, Gate, Site, Validation } from "../../contracts/generated.ts";
import type { HookResult } from "../../data/hooks.ts";
import { checkReport, type BrokenRecord, type CheckedReport, type ComparisonItem, type G2Series, type GateItem } from "./check";

// ── Page state ───────────────────────────────────────────────────────────────

export type PageState =
  | { kind: "loading" }
  /** The file is missing or cannot be read: the page shows no numbers. */
  | { kind: "not-run" }
  | { kind: "ready"; report: CheckedReport };

/**
 * `loadValidation` gives null for a missing file; a file that cannot be read or parsed
 * is an error; a file without the outline the page needs fails `checkReport`. All three
 * read "Validation has not been run on this build".
 */
export function pageState(result: HookResult<Validation | null>): PageState {
  if (result.status === "loading") return { kind: "loading" };
  if (result.status === "error" || result.data === null) return { kind: "not-run" };
  const report = checkReport(result.data);
  return report ? { kind: "ready", report } : { kind: "not-run" };
}

export const NOT_RUN_MESSAGE = "Validation has not been run on this build";

// ── Gates ────────────────────────────────────────────────────────────────────

/**
 * "elsewhere": `passed` is null, so this run did not measure the gate. It is checked by
 * the web test suite, and is never shown as passed or failed.
 */
export type GateVerdict = "passed" | "failed" | "elsewhere";

export function gateVerdict(gate: Gate): GateVerdict {
  if (gate.passed === null) return "elsewhere";
  return gate.passed ? "passed" : "failed";
}

export const GATE_VERDICT_LABEL: Record<GateVerdict, string> = {
  passed: "Passed",
  failed: "Failed",
  elsewhere: "Checked in the web tests",
};

/** Which part of the page each gate belongs to. A gate not listed goes to "other". */
const TERRAIN_GATES = new Set(["G4", "G5", "G6", "G7", "G8"]);
export const SKY_GATE_ID = "G2";

export type GateGroups = {
  /** Gate G2, the Sun and Earth directions against JPL Horizons. */
  sky: GateItem | null;
  /** The synthetic terrain tests. */
  terrain: GateItem[];
  /** Every other gate, in file order, so none is left off the page. Unknown ids land here. */
  other: GateItem[];
};

/** A record's id, whole or broken. */
export function itemId(item: GateItem | ComparisonItem): string | null {
  if (item.kind === "broken") return item.id;
  return item.kind === "gate" ? item.gate.id : item.comparison.id;
}

export function groupGates(items: readonly GateItem[]): GateGroups {
  const sky = items.find((item) => itemId(item) === SKY_GATE_ID) ?? null;
  const terrain = (item: GateItem) => TERRAIN_GATES.has(itemId(item) ?? "");
  return {
    sky,
    terrain: items.filter(terrain),
    other: items.filter((item) => item !== sky && !terrain(item)),
  };
}

export type GateSummary = {
  total: number;
  measured: number;
  passed: number;
  failed: number;
  elsewhere: number;
  /** Records the page could not read. Never counted as passed. */
  incomplete: number;
};

/** Counts of the file's gates, for the summary line. */
export function summariseGates(items: readonly GateItem[]): GateSummary {
  const verdicts = items.flatMap((item) => (item.kind === "gate" ? [gateVerdict(item.gate)] : []));
  const count = (verdict: GateVerdict) => verdicts.filter((item) => item === verdict).length;
  return {
    total: items.length,
    measured: count("passed") + count("failed"),
    passed: count("passed"),
    failed: count("failed"),
    elsewhere: count("elsewhere"),
    incomplete: items.length - verdicts.length,
  };
}

// ── Units and numbers ────────────────────────────────────────────────────────

/** The unit as shown after a number. "fraction" and "difference" have none. */
export function unitSymbol(unit: string): string {
  if (unit === "deg") return "°";
  if (unit === "fraction" || unit === "difference") return "";
  return unit;
}

// ── Comparisons ──────────────────────────────────────────────────────────────

/** Plain names of the reported comparisons in docs/validation.md. */
export const COMPARISON_TITLES: Record<string, string> = {
  R1: "Average sunlight",
  R2: "Earth in view",
  R3: "Slope from the polar map",
  R4: "Slope from a close-up map",
  R5: "The skyline at a finer step",
  R6: "The fast skyline against the full method",
};

/** R5 and R6 compare our method with itself (docs/validation.md): there is no NASA value. */
const SELF_COMPARISONS = new Set(["R5", "R6"]);

export function isSelfComparison(id: string): boolean {
  return SELF_COMPARISONS.has(id);
}

export type ComparisonVerdict = "within" | "outside";

export const COMPARISON_VERDICT_LABEL: Record<ComparisonVerdict, string> = {
  within: "Within the mark",
  outside: "Outside the mark",
};

export type ComparisonRow = {
  kind: "row";
  key: string;
  id: string;
  siteId: string;
  siteName: string;
  unit: string;
  ours: number;
  reference: number;
  /** Ours minus the reference: a display value derived from the file's two numbers. */
  difference: number;
  mark: number;
  verdict: ComparisonVerdict;
  explanation: string | null;
  referenceSource: string;
};

export function siteNames(sites: readonly Site[] | null | undefined): Map<string, string> {
  return new Map((sites ?? []).map((site) => [site.id, site.name]));
}

function toRow(comparison: Comparison, index: number, names: ReadonlyMap<string, string>): ComparisonRow {
  return {
    kind: "row",
    key: `${comparison.id}-${comparison.site_id}-${index}`,
    id: comparison.id,
    siteId: comparison.site_id,
    siteName: names.get(comparison.site_id) ?? comparison.site_id,
    unit: comparison.unit,
    ours: comparison.ours,
    reference: comparison.reference,
    difference: comparison.ours - comparison.reference,
    mark: comparison.investigate_above,
    // The file's own flag decides, never a fresh comparison here.
    verdict: comparison.outside_mark ? "outside" : "within",
    explanation: comparison.explanation,
    referenceSource: comparison.reference_source,
  };
}

/** A row whose record is incomplete: shown in its place with its id and site. */
export type BrokenRow = { kind: "broken"; key: string; id: string | null; name: string | null };

export type TableRow = ComparisonRow | BrokenRow;

function brokenRow(record: BrokenRecord, index: number, names: ReadonlyMap<string, string>): BrokenRow {
  return {
    kind: "broken",
    key: `broken-${index}`,
    id: record.id,
    name: record.name === null ? null : (names.get(record.name) ?? record.name),
  };
}

/** The complete rows of one comparison, in file order. A row outside its mark is never dropped. */
export function comparisonRows(
  items: readonly ComparisonItem[],
  id: string,
  names: ReadonlyMap<string, string> = new Map(),
): ComparisonRow[] {
  return items.flatMap((item, index) =>
    item.kind === "comparison" && item.comparison.id === id ? [toRow(item.comparison, index, names)] : [],
  );
}

/** Every row of one comparison, complete or not, in file order: what its table shows. */
export function tableRows(
  items: readonly ComparisonItem[],
  id: string,
  names: ReadonlyMap<string, string> = new Map(),
): TableRow[] {
  return items.flatMap((item, index): TableRow[] => {
    if (itemId(item) !== id) return [];
    return item.kind === "comparison" ? [toRow(item.comparison, index, names)] : [brokenRow(item, index, names)];
  });
}

/** Records with no usable id, so no comparison to show them under: listed on their own. */
export function brokenWithoutId(
  items: readonly ComparisonItem[],
  names: ReadonlyMap<string, string> = new Map(),
): BrokenRow[] {
  return items.flatMap((item, index) =>
    item.kind === "broken" && item.id === null ? [brokenRow(item, index, names)] : [],
  );
}

/** Comparison ids in the file, in first-seen order, including those of incomplete rows. */
export function comparisonIds(items: readonly ComparisonItem[]): string[] {
  return [...new Set(items.map(itemId).filter((id): id is string => id !== null))];
}

export type ComparisonSummary = { total: number; outside: number; incomplete: number };

export function summariseComparisons(items: readonly ComparisonItem[]): ComparisonSummary {
  const whole = items.flatMap((item) => (item.kind === "comparison" ? [item.comparison] : []));
  return {
    total: items.length,
    outside: whole.filter((item) => item.outside_mark).length,
    incomplete: items.length - whole.length,
  };
}

/** Section 4 holds R1 and R2; section 5 holds every other comparison in the file. */
export const MAP_COMPARISONS = ["R1", "R2"] as const;

export function slopeSectionIds(items: readonly ComparisonItem[]): string[] {
  const map = new Set<string>(MAP_COMPARISONS);
  return comparisonIds(items).filter((id) => !map.has(id));
}

// ── Scatter chart (R1, R2) ───────────────────────────────────────────────────

export type ScatterPoint = {
  key: string;
  /** NASA's value, on the horizontal axis. */
  x: number;
  /** Ours, on the vertical axis. */
  y: number;
  label: string;
  outside: boolean;
};

export function scatterPoints(rows: readonly ComparisonRow[]): ScatterPoint[] {
  return rows.map((row) => ({
    key: row.key,
    x: row.reference,
    y: row.ours,
    label: row.siteName,
    outside: row.verdict === "outside",
  }));
}

/** The comparison's mark, when every row shares one (they do in practice). */
export function sharedMark(rows: readonly ComparisonRow[]): number | null {
  const first = rows[0];
  if (!first) return null;
  return rows.every((row) => row.mark === first.mark) ? first.mark : null;
}

// ── Gate G2 over time ────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;

/** A value the file leaves out is null: a gap in the line. */
export type G2Point = { time: Date; value: number | null };

export type G2Line = { body: "sun" | "earth"; points: G2Point[] };

/** Sites that have a G2 series, in file order. */
export function g2Sites(series: readonly G2Series[] | null | undefined): string[] {
  return [...new Set((series ?? []).map((item) => item.site_id))];
}

function seriesPoints(item: G2Series): G2Point[] {
  const start = Date.parse(item.start_utc);
  if (!Number.isFinite(start)) return [];
  const step = item.step_h * HOUR_MS;
  return item.max_difference_deg.map((value, index) => ({ time: new Date(start + index * step), value }));
}

/** The Sun and Earth lines for one site. */
export function g2Lines(series: readonly G2Series[] | null | undefined, siteId: string): G2Line[] {
  return (series ?? [])
    .filter((item) => item.site_id === siteId)
    .map((item) => ({ body: item.body, points: seriesPoints(item) }));
}

export type G2Peak = { siteId: string; body: "sun" | "earth"; time: Date; value: number };

/** The largest value among the given series: the largest of the file's own numbers. */
export function g2Peak(series: readonly G2Series[] | null | undefined): G2Peak | null {
  let peak: G2Peak | null = null;
  for (const item of series ?? []) {
    for (const point of seriesPoints(item)) {
      if (point.value === null || !Number.isFinite(point.value)) continue;
      if (peak === null || point.value > peak.value) {
        peak = { siteId: item.site_id, body: item.body, time: point.time, value: point.value };
      }
    }
  }
  return peak;
}

/** The site shown first in the chart: the one holding the largest difference. */
export function defaultG2Site(series: readonly G2Series[] | null | undefined): string | null {
  return g2Peak(series)?.siteId ?? g2Sites(series)[0] ?? null;
}

export type YearPeak = { year: number; sun: number | null; earth: number | null };

/** The largest difference in each UTC year, per body, for the table beside the chart. */
export function g2YearPeaks(lines: readonly G2Line[]): YearPeak[] {
  const years = new Map<number, YearPeak>();
  for (const line of lines) {
    for (const point of line.points) {
      if (point.value === null || !Number.isFinite(point.value)) continue;
      const year = point.time.getUTCFullYear();
      const entry = years.get(year) ?? { year, sun: null, earth: null };
      const current = entry[line.body];
      if (current === null || point.value > current) entry[line.body] = point.value;
      years.set(year, entry);
    }
  }
  return [...years.values()].sort((a, b) => a.year - b.year);
}

/** "2027-01-07" for a point on the chart. */
export function utcDay(time: Date): string {
  return time.toISOString().slice(0, 10);
}

// ── Sources ──────────────────────────────────────────────────────────────────

/** A link only when the file gives a web address; an empty or odd value is shown as text. */
export function isWebLink(url: string): boolean {
  return /^https?:\/\//.test(url);
}

// ── Gate G2's raw compass-bearing note ───────────────────────────────────────

/**
 * The sentences of G2's `detail` that speak of the raw compass bearing, word for word.
 * Decision 0011 says the raw bearing difference is shown beside the gate; the file holds
 * it only inside `detail`, so the page quotes those sentences and reads no number out of
 * them. A sentence ends at a full stop followed by a space and a letter, so "0.0823" and
 * "system.bin" stay whole. Null when no sentence mentions it.
 */
export function rawBearingNote(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const sentences = detail.split(/(?<=\.)\s+(?=[A-Za-z])/);
  const raw = sentences.filter((sentence) => /\braw\b/i.test(sentence));
  return raw.length > 0 ? raw.join(" ") : null;
}
