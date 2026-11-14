/**
 * The Compare table's content, as plain data (docs/features/compare.md).
 *
 * Display only, and no second computation. Every number and word comes from the
 * functions the focused-site panel uses: `useSiteStatus` (through `useEvaluation`) for
 * the evaluation, and `describeEvaluation`, `describeMetrics`, `scoreText`
 * and `settingsProvenance` from `app/mission/rules.ts` for the wording. This file only
 * lays them out side by side, marks the best value in a row, and writes the summary
 * sentence from the statuses.
 *
 * The CSV export (`lib/export/compare-csv.ts`) is built from this same model, so the file
 * and the screen cannot disagree.
 */

import type { MissionProfile, Site } from "../../../contracts/generated";
import { formatNumber, formatUtc } from "../../../components/format";
import type { Evaluation, Status } from "../../../lib/scoring";
import {
  describeEvaluation,
  describeMetrics,
  formatLimit,
  formatValue,
  ruleFields,
  scoreText,
  settingsProvenance,
  type EvaluationView,
  type MetricView,
  type RuleView,
  type SettingsProvenance,
} from "../../../app/mission/rules";
import { NO_RESULT_TEXT, isSphere, siteName, type SiteStatus } from "../../../app/mission/site-status";
import type { ProfileField } from "../../../state/scenario";
import { ARTEMIS_NOTE, nearbyRangeText, parentOf, upperReadingLine, variantLine } from "../../../app/mission/site-labels";

/** The note for an Artemis candidate entry (the shared wording, `app/mission/site-labels.ts`). */
export const MAP_CENTRE_NOTE = ARTEMIS_NOTE;
export const SPHERE_NOTE = "Terrain not modelled";
export const SLOPE_NOT_ASSESSED = "Slope not assessed";
/** Why a best-lit point carries no "best" mark for sunlight: the table's footer says so. */
export const NOT_RANKED_NOTE = "A best-lit point is not ranked for sunlight, because its reading is an upper one.";
export const TOO_FEW_SITES = "Compare needs two or more sites. Add one from the sites rail.";

/** One selected site, ready to draw as a column. */
export type ColumnView = {
  siteId: string;
  name: string;
  site: Site | null;
  /** For a best-lit variant, the site it belongs to. */
  parent: Site | null;
  /** "−89.4555°, 222.6190° E", as in the focused-site panel. */
  coords: string | null;
  /** "core80", "core80, close-up DEM", or "Terrain not modelled". */
  tier: string | null;
  /** Lines under the name: the map-centre note. */
  notes: string[];
  /** For a best-lit variant: "Best-lit map pixel, 149 m from Connecting Ridge". */
  chosenBy: string | null;
  status: SiteStatus;
  evaluation: Evaluation | null;
  rules: EvaluationView | null;
  /** `describeMetrics`, keyed by its `term`. */
  metrics: Readonly<Record<string, MetricView>> | null;
};

function variantNote(site: Site, sites: readonly Site[]): string | null {
  const parent = parentOf(site, sites);
  return variantLine(site, parent ? siteName(parent, parent.id) : null);
}

export function compareColumn(siteId: string, sites: readonly Site[], status: SiteStatus, profile: MissionProfile): ColumnView {
  const site = sites.find((s) => s.id === siteId) ?? null;
  const evaluation = status.kind === "ready" ? status.evaluation : null;
  const notes: string[] = [];
  if (site?.group === "artemis" && !site.variant_of) notes.push(MAP_CENTRE_NOTE);
  return {
    siteId,
    name: siteName(site, siteId),
    site,
    parent: parentOf(site, sites),
    coords: site ? `${formatNumber(site.lat_deg, 4)}°, ${formatNumber(site.lon_deg, 4)}° E` : null,
    tier: site ? (isSphere(site) ? SPHERE_NOTE : `${site.terrain_tier}${site.has_closeup ? ", close-up DEM" : ""}`) : null,
    notes,
    chosenBy: site ? variantNote(site, sites) : null,
    status,
    evaluation,
    rules: evaluation ? describeEvaluation(evaluation, profile) : null,
    metrics: evaluation ? Object.fromEntries(describeMetrics(evaluation).map((m) => [m.term, m])) : null,
  };
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export type MetricRowId = "sunlight" | "dark" | "link" | "blackout" | "landing_sun" | "slope";

/** One value in a metric row. `null` when the site has no result yet. */
export type Cell = {
  /** As printed: "31 h", "0.82", "3.1°", "Slope not assessed". */
  text: string;
  /** The number as printed, for "best" and the CSV. `null` for text only. */
  value: number | null;
  /** A second, smaller line: "91.0 % lit", "over 160 m". */
  sub: string | null;
  /** Further small lines: the nearby range, "upper reading". */
  notes: string[];
  /** 0–1 along the row's shared scale, for the rows with bars. */
  bar: number | null;
  broken: boolean;
  best: boolean;
};

export type MetricRow = {
  id: MetricRowId;
  name: string;
  /** The explain.ts term behind the row name. */
  term: string;
  /** "limit 6 h", "at least 3°", or "" when no limit applies. */
  limitText: string;
  /** The tag of every profile setting behind the row. */
  provenance: SettingsProvenance;
  /** "Lower is best" etc., read with the "best" marks. */
  bestRule: string | null;
  cells: (Cell | null)[];
  /** The row whose values differ most where a site breaks a rule (compare.md, Layout). */
  deciding: boolean;
};

/** Printed decimals per row, so "best" compares what the reader sees. */
const DECIMALS: Record<MetricRowId, number> = {
  sunlight: 2,
  dark: 0,
  link: 1,
  blackout: 0,
  landing_sun: 2,
  slope: 1,
};

export function printed(value: number, decimals: number): number {
  return Number(formatNumber(value, decimals).replace("−", "-"));
}

function metricText(metric: MetricView): string {
  return typeof metric.value === "number" ? formatValue(metric.value, metric.unit, metric.decimals) : metric.value;
}

export function metricNumber(metric: MetricView | undefined): number | null {
  return metric && typeof metric.value === "number" ? printed(metric.value, metric.decimals) : null;
}

function cellOf(partial: Partial<Cell> & Pick<Cell, "text">): Cell {
  return { value: null, sub: null, notes: [], bar: null, broken: false, best: false, ...partial };
}


function litFields(profile: MissionProfile): ProfileField[] {
  return profile.ops_sun_el_min_deg === null ? ["min_sun_fraction"] : ["min_sun_fraction", "ops_sun_el_min_deg"];
}

function landingFields(profile: MissionProfile): ProfileField[] {
  const fields = litFields(profile);
  if (profile.landing_sun_el_min_deg !== null) fields.push("landing_sun_el_min_deg");
  if (profile.landing_sun_el_max_deg !== null) fields.push("landing_sun_el_max_deg");
  return fields;
}

function landingLimitText(profile: MissionProfile): string {
  const parts = ["lit"];
  if (profile.landing_sun_el_min_deg !== null) parts.push(`at least ${formatLimit(profile.landing_sun_el_min_deg, "°")}`);
  if (profile.landing_sun_el_max_deg !== null) parts.push(`at most ${formatLimit(profile.landing_sun_el_max_deg, "°")}`);
  return parts.length === 1 ? "needs sunlight" : `${parts.slice(1).join(", ")}, and lit`;
}

/**
 * Marks the best printed value in a row. Every site tied for best is marked. Nothing is
 * marked with fewer than two values, or when every value is equal: then no site is better.
 */
export function markBest(cells: (Cell | null)[], direction: "higher" | "lower", eligible: (index: number) => boolean = () => true): void {
  const candidates = cells.flatMap((cell, index) => (cell && cell.value !== null && eligible(index) ? [{ cell, value: cell.value }] : []));
  if (candidates.length < 2) return;
  const values = candidates.map((c) => c.value);
  const best = direction === "higher" ? Math.max(...values) : Math.min(...values);
  if (values.every((v) => v === best)) return;
  for (const c of candidates) if (c.value === best) c.cell.best = true;
}

export function metricRows(columns: readonly ColumnView[], profile: MissionProfile): MetricRow[] {
  const m = (column: ColumnView, term: string) => column.metrics?.[term];

  const sunlight: MetricRow = {
    id: "sunlight",
    name: "Sunlight",
    term: "sun_fraction_mean",
    limitText: "mean Sun disc fraction, and hours lit",
    provenance: settingsProvenance(profile, litFields(profile)),
    bestRule: "highest mean disc fraction",
    deciding: false,
    cells: columns.map((column) => {
      const mean = m(column, "sun_fraction_mean");
      const lit = m(column, "lit_fraction");
      if (!mean || !lit) return null;
      const notes: string[] = [];
      const range = nearbyRangeText(column.site?.nearby_sun);
      if (range) notes.push(range);
      const upper = column.site ? upperReadingLine(column.site, column.parent) : null;
      if (upper) notes.push(upper);
      return cellOf({
        text: metricText(mean),
        value: metricNumber(mean),
        sub: `${metricText(lit)} lit`,
        notes,
        bar: column.evaluation ? column.evaluation.metrics.sunFractionMean : null,
      });
    }),
  };
  // A best-lit variant is chosen to be our highest estimate, so it would win by construction.
  markBest(sunlight.cells, "higher", (index) => !columns[index]?.site?.variant_of);

  const darkLimit = profile.max_dark_h;
  const dark: MetricRow = {
    id: "dark",
    name: "Longest dark stretch",
    term: "longest_dark_h",
    limitText: `limit ${formatLimit(darkLimit, "h")}`,
    provenance: settingsProvenance(profile, ruleFields(profile, "darkness")),
    bestRule: "lowest",
    deciding: false,
    cells: columns.map((column) => {
      const metric = m(column, "longest_dark_h");
      return metric ? cellOf({ text: metricText(metric), value: metricNumber(metric), broken: metric.broken }) : null;
    }),
  };
  markBest(dark.cells, "lower");

  const linkFields: ProfileField[] = profile.relay_available ? ["relay_available"] : ["relay_available", "antenna_mask_deg"];
  const link: MetricRow = {
    id: "link",
    name: "Earth link",
    term: "link_fraction",
    limitText: profile.relay_available ? "relay: always linked" : `share of hours, Earth ${formatLimit(profile.antenna_mask_deg, "°")} clear`,
    provenance: settingsProvenance(profile, linkFields),
    bestRule: "highest",
    deciding: false,
    cells: columns.map((column) => {
      const metric = m(column, "link_fraction");
      if (!metric) return null;
      return cellOf({
        text: metricText(metric),
        value: metricNumber(metric),
        bar: column.evaluation ? column.evaluation.metrics.linkFraction : null,
      });
    }),
  };
  markBest(link.cells, "higher");

  const blackout: MetricRow = {
    id: "blackout",
    name: "Longest blackout",
    term: "longest_blackout_h",
    limitText: profile.relay_available ? "no limit: a relay is available" : `limit ${formatLimit(profile.max_blackout_h, "h")}`,
    provenance: settingsProvenance(profile, ruleFields(profile, profile.relay_available ? "relay" : "blackout")),
    bestRule: "lowest",
    deciding: false,
    cells: columns.map((column) => {
      const metric = m(column, "longest_blackout_h");
      return metric ? cellOf({ text: metricText(metric), value: metricNumber(metric), broken: metric.broken }) : null;
    }),
  };
  markBest(blackout.cells, "lower");

  const landing: MetricRow = {
    id: "landing_sun",
    name: "Sun at landing",
    term: "landing_sun_el_deg",
    limitText: landingLimitText(profile),
    provenance: settingsProvenance(profile, landingFields(profile)),
    bestRule: null,
    deciding: false,
    cells: columns.map((column) => {
      const el = m(column, "landing_sun_el_deg");
      const lit = m(column, "landing_lit");
      if (!el || !lit) return null;
      return cellOf({
        text: metricText(el),
        value: metricNumber(el),
        sub: lit.value === "yes" ? "lit" : "dark",
        broken: el.broken || lit.broken,
      });
    }),
  };

  const slope: MetricRow = {
    id: "slope",
    name: "Slope",
    term: "slope",
    limitText: `limit ${formatLimit(profile.max_slope_deg, "°")}`,
    provenance: settingsProvenance(profile, ruleFields(profile, "slope")),
    bestRule: "lowest",
    deciding: false,
    cells: columns.map((column) => {
      if (!column.evaluation) return null;
      const site = column.site;
      if (!site?.slope) {
        return cellOf({ text: SLOPE_NOT_ASSESSED, sub: isSphere(site) ? "terrain not modelled" : null });
      }
      return cellOf({
        text: formatValue(site.slope.deg, "°", DECIMALS.slope),
        value: printed(site.slope.deg, DECIMALS.slope),
        sub: `over ${formatValue(site.slope.baseline_m, "m")}`,
        broken: column.evaluation.vetoes.slope.triggered,
      });
    }),
  };
  markBest(slope.cells, "lower");

  const rows = [sunlight, dark, link, blackout, landing, slope];
  const decider = decidingRow(rows, profile);
  if (decider) decider.deciding = true;
  return rows;
}

/** The limit a row is measured against, for scaling its spread; null when it has none. */
export function rowLimit(row: Pick<MetricRow, "id">, profile: MissionProfile): number | null {
  switch (row.id) {
    case "dark":
      return profile.max_dark_h;
    case "blackout":
      return profile.relay_available ? null : profile.max_blackout_h;
    case "slope":
      return profile.max_slope_deg;
    case "landing_sun": {
      // The profile's landing-Sun window (degrees), when it sets one: the larger bound.
      const bounds = [profile.landing_sun_el_min_deg, profile.landing_sun_el_max_deg].filter((v): v is number => v !== null);
      return bounds.length > 0 ? Math.max(...bounds.map(Math.abs)) : null;
    }
    default:
      return null;
  }
}

/**
 * The row that decides between the sites: among the rows where one site breaks a rule and
 * another does not, the one whose printed values spread furthest, as a share of its limit
 * (or of its largest value when it has none). None when no rule splits the sites.
 */
export function decidingRow(rows: readonly MetricRow[], profile: MissionProfile): MetricRow | null {
  let best: { row: MetricRow; spread: number } | null = null;
  for (const row of rows) {
    const cells = row.cells.filter((c): c is Cell => c !== null);
    if (!cells.some((c) => c.broken) || !cells.some((c) => !c.broken)) continue;
    const values = cells.flatMap((c) => (c.value === null ? [] : [c.value]));
    const range = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
    const scale = Math.max(Math.abs(rowLimit(row, profile) ?? Math.max(...values.map(Math.abs), 0)), 1);
    const spread = range / scale;
    if (!best || spread > best.spread) best = { row, spread };
  }
  return best?.row ?? null;
}

// ── Status, broken rules and the score ──────────────────────────────────────

export type StatusCell = {
  status: Status;
  /** As the focused-site panel prints it: rounded down. */
  scoreText: string;
  score: number;
  /** A NO-GO site's score is not used. */
  used: boolean;
  best: boolean;
};

export function statusCells(columns: readonly ColumnView[]): (StatusCell | null)[] {
  const cells: (StatusCell | null)[] = columns.map((column) =>
    column.evaluation
      ? {
          status: column.evaluation.status,
          scoreText: scoreText(column.evaluation.score),
          score: column.evaluation.score,
          used: column.evaluation.status !== "NO-GO",
          best: false,
        }
      : null,
  );
  // The best score among the sites whose score counts, on the printed number.
  const used = cells.filter((c): c is StatusCell => c !== null && c.used);
  if (used.length >= 2) {
    const values = used.map((c) => Number(c.scoreText));
    const top = Math.max(...values);
    if (!values.every((v) => v === top)) for (const c of used) if (Number(c.scoreText) === top) c.best = true;
  }
  return cells;
}

/** A broken rule in one line: "Longest blackout 31 h, limit 12 h", or "Dark at landing". */
export function brokenRuleText(rule: RuleView): string {
  if (rule.value === null) return rule.name;
  return `${rule.name} ${rule.valueLabel}${rule.limitText ? `, ${rule.limitText}` : ""}`;
}

// ── The sentence that sums it up ────────────────────────────────────────────

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

function count(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "A", "A and B", "A, B and C". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  // "Connecting Ridge, best-lit point" holds a comma, so such lists are split by semicolons.
  if (names.length > 2 && names.some((name) => name.includes(","))) return `${names.slice(0, -1).join("; ")}; and ${names[names.length - 1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function landingDate(landingUtc: string): string {
  return formatUtc(landingUtc);
}

/**
 * One plain sentence (or two) from the statuses and the broken rules, never claiming more
 * than the numbers show (docs/features/compare.md, "A sentence that sums it up").
 */
export function summarySentence(columns: readonly ColumnView[], profile: MissionProfile, landingUtc: string): string {
  const who = profile.id === "custom" ? "a custom profile" : profile.name;
  const lead = `For ${who} landing ${landingDate(landingUtc)}`;
  if (columns.length === 0) return "No sites are selected. Add sites from the sites rail to compare them.";
  if (columns.some((c) => c.status.kind === "loading")) return `${lead}: loading the sites' data…`;

  const ready = columns.filter((c) => c.evaluation !== null);
  // "every", "both" and "all" only when every column has a result.
  const complete = ready.length === columns.length;
  const allOf = (n: number) =>
    complete ? (n === 2 ? "both sites" : `all ${count(n)} sites`) : `the ${count(n)} sites with a result`;
  const failed = columns.filter((c) => c.status.kind === "error");
  const none = columns.filter((c) => c.status.kind === "none");
  const tail: string[] = [];
  if (failed.length > 0) tail.push(`${nameList(failed.map((c) => c.name))} could not be loaded.`);
  if (none.length > 0) tail.push(`${nameList(none.map((c) => c.name))}: ${NO_RESULT_TEXT.charAt(0).toLowerCase()}${NO_RESULT_TEXT.slice(1)}.`);

  if (ready.length === 0) return [`${lead}, no site has a result.`, ...tail].join(" ");

  if (columns.length === 1 && ready.length === 1) {
    const only = ready[0] as ColumnView;
    const evaluation = only.evaluation as Evaluation;
    const reason = evaluation.status === "NO-GO" ? `: it fails on ${failText(only)}` : "";
    return `${lead}, ${only.name} is ${evaluation.status}${reason}. ${TOO_FEW_SITES}`;
  }

  const by = (status: Status) => ready.filter((c) => c.evaluation?.status === status);
  const go = by("GO");
  const caution = by("CAUTION");
  const nogo = by("NO-GO");
  const sentences: string[] = [];

  if (go.length === 1) {
    sentences.push(`${lead}, ${(go[0] as ColumnView).name} is the only GO site.`);
  } else if (go.length > 1) {
    const all = go.length === ready.length ? allOf(ready.length) : nameList(go.map((c) => c.name));
    sentences.push(`${lead}, ${all} are GO.`);
    sentences.push(scoreLeader(go));
  } else if (caution.length > 0) {
    const names = nameList(caution.map((c) => c.name));
    sentences.push(
      caution.length === ready.length && caution.length > 1
        ? `${lead}, no site is GO; ${allOf(caution.length).replace(/ sites$/, "")} are CAUTION.`
        : `${lead}, no site is GO; ${names} ${caution.length === 1 ? "is" : "are"} CAUTION.`,
    );
    if (caution.length > 1) sentences.push(scoreLeader(caution));
  } else {
    sentences.push(
      complete
        ? `${lead}, every site is NO-GO.`
        : ready.length === 1
          ? `${lead}, the only site with a result is NO-GO.`
          : `${lead}, ${allOf(ready.length)} are NO-GO.`,
    );
  }

  if (go.length > 0 && caution.length > 0) {
    sentences.push(`${nameList(caution.map((c) => c.name))} ${caution.length === 1 ? "is" : "are"} CAUTION.`);
  }
  if (nogo.length > 0 && nogo.length <= 2) {
    for (const c of nogo) sentences.push(`${c.name} fails on ${failText(c)}.`);
  } else if (nogo.length > 2 && nogo.length < ready.length) {
    sentences.push(`${capitalised(count(nogo.length))} sites are NO-GO.`);
  }
  return [...sentences, ...tail].join(" ");
}

/**
 * "a 31 h blackout (limit 12 h)": the worst broken rule, with the value and limit exactly
 * as the focused-site panel prints them, and how many more rules break.
 */
export function failText(column: ColumnView): string {
  const broken = column.rules?.broken ?? [];
  const worst = broken[0];
  if (!worst) return "a broken rule";
  const v = worst.valueLabel;
  const limit = worst.limitText ? ` (${worst.limitText})` : "";
  let phrase: string;
  switch (worst.id) {
    case "landing_dark":
      phrase = "a dark landing";
      break;
    case "darkness":
      phrase = `a ${v} dark stretch${limit}`;
      break;
    case "blackout":
      phrase = `a ${v} blackout${limit}`;
      break;
    case "slope":
      phrase = `a ${v} slope${limit}`;
      break;
    default:
      phrase = `the Sun at ${v} at landing${limit}`;
  }
  const more = broken.length - 1;
  return more === 0 ? phrase : `${phrase} and ${count(more)} more ${more === 1 ? "rule" : "rules"}`;
}

/** Who scores highest among sites of one status, or the tie. */
function scoreLeader(columns: readonly ColumnView[]): string {
  const scored = columns.map((c) => ({ name: c.name, text: scoreText((c.evaluation as Evaluation).score) }));
  const top = Math.max(...scored.map((s) => Number(s.text)));
  const leaders = scored.filter((s) => Number(s.text) === top);
  if (leaders.length === scored.length) return `They tie on score, ${top} of 100.`;
  if (leaders.length > 1) return `${nameList(leaders.map((l) => l.name))} tie for the highest score, ${top} of 100.`;
  return `${(leaders[0] as { name: string }).name} scores highest, ${top} of 100.`;
}

/** The slope sources behind the table, each once. */
export function slopeSources(columns: readonly ColumnView[]): string[] {
  return [...new Set(columns.flatMap((c) => (c.site?.slope ? [c.site.slope.source] : [])))];
}
