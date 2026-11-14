/**
 * The Compare window's two exports (docs/features/share-export.md, "Export data"):
 *
 * - the comparison as CSV, one row per site, with the values exactly as the table prints
 *   them (built from the same `ColumnView`s and `MetricRow`s);
 * - the scenario with its results as JSON, with the evaluation's full-precision numbers.
 *
 * Both carry the profile with every limit's sourced or assumed tag, the landing date, the
 * mission window, the time grid's range, the time the file was made, the data's source and
 * the caveat. Times are UTC ending in Z; angles are degrees; units are in the names.
 */

import type { Assumed, MissionProfile, Sourced, TimeGrid } from "../../../contracts/generated";
import { fieldDef } from "../../../app/mission/profile-fields";
import { provenanceOf } from "../../../app/mission/rules";
import { windowLength } from "../../../lib/scoring";
import { CAVEAT, DATA_SOURCE, fileDate, fileProfile, gridRange, toCsv, utcSeconds, type CsvValue } from "../../../lib/export";
import { hourIndexToUtc, utcToHourIndex } from "../../../lib/time";
import { PROFILE_FIELDS, type ProfileField, type ViewId } from "../../../state/scenario";
import type { DatesPicks } from "./dates";
import { brokenRuleText, metricNumber, statusCells, type ColumnView, type MetricRow } from "./model";

export type ExportScenario = {
  profile: MissionProfile;
  /** The preset a custom profile is based on, and the fields changed from it. */
  basePresetId: string;
  changedFields: readonly ProfileField[];
  siteIds: readonly string[];
  focusedSiteId: string | null;
  landingUtc: string;
  currentUtc: string;
  view: ViewId;
  grid: TimeGrid;
  /** The shareable link to this scenario. */
  link: string;
};

/** The mission window's first and last hour, UTC. */
export function missionWindow(grid: TimeGrid, landingUtc: string, durationDays: number): { start_utc: string; end_utc: string; hours: number } {
  const hours = windowLength(durationDays);
  const start = utcToHourIndex(grid, landingUtc);
  const last = Math.min(start + hours - 1, grid.count - 1);
  return { start_utc: landingUtc, end_utc: hourIndexToUtc(grid, last), hours };
}

function profileValueText(profile: MissionProfile, field: ProfileField): string {
  const value = profile[field];
  if (field === "weights") {
    const w = profile.weights;
    return `slope ${w.slope}, power ${w.power}, comms ${w.comms}`;
  }
  if (value === null) return "no limit";
  if (typeof value === "boolean") return value ? "yes" : "no";
  const unit = fieldDef(field).unit;
  return unit === "" ? String(value) : unit === "°" ? `${value} deg` : `${value} ${unit}`;
}

function provenanceText(provenance: Sourced | Assumed | null): string {
  if (!provenance) return "no tag";
  return provenance.kind === "sourced" ? `sourced: ${provenance.source_url}` : `assumed: ${provenance.reason}`;
}

/** One line per profile value: "Longest dark stretch (max_dark_h) = 6 h; assumed: …". */
export function profileLines(profile: MissionProfile): string[] {
  return PROFILE_FIELDS.map(
    (field) => `${fieldDef(field).label} (${field}) = ${profileValueText(profile, field)}; ${provenanceText(provenanceOf(profile, field))}`,
  );
}

function profileLabel(scenario: ExportScenario): string {
  const { profile } = scenario;
  if (scenario.changedFields.length === 0) return `${profile.name} (${profile.id})`;
  return `${profile.name} (${profile.id}), based on ${scenario.basePresetId}, changed: ${scenario.changedFields.join(", ")}`;
}

function headerComments(title: string, scenario: ExportScenario, made: Date, dates: DatesPicks | null = null): string[] {
  const grid = gridRange(scenario.grid);
  const windowLine = (label: string, landingUtc: string) => {
    const window = missionWindow(scenario.grid, landingUtc, scenario.profile.duration_days);
    return `${label}: ${window.start_utc} to ${window.end_utc} (${window.hours} h)`;
  };
  const landing = dates
    ? [
        `Landing dates: date 1 ${dates.date1}, date 2 ${dates.date2} (the scenario's landing date is ${scenario.landingUtc})`,
        windowLine("Mission window, date 1", dates.date1),
        windowLine("Mission window, date 2", dates.date2),
      ]
    : [`Landing date: ${scenario.landingUtc}`, windowLine("Mission window", scenario.landingUtc)];
  return [
    title,
    `Profile: ${profileLabel(scenario)}`,
    ...landing,
    `Made: ${utcSeconds(made)}`,
    `Time grid: ${grid.start_utc} to ${grid.end_utc}, every ${grid.step_s} s`,
    `Source: ${DATA_SOURCE}`,
    CAVEAT,
    "Profile values, each with its sourced or assumed tag:",
    ...profileLines(scenario.profile).map((line) => `  ${line}`),
    `Link: ${scenario.link}`,
  ];
}

/** The CSV's columns, units in the names. */
export const COMPARE_CSV_HEADER = [
  "site_id",
  "site_name",
  "lat_deg",
  "lon_east_deg",
  "terrain_tier",
  "status",
  "score_of_100",
  "score_used",
  "broken_rules",
  "sun_fraction_mean",
  "lit_pct",
  "longest_dark_h",
  "link_pct",
  "longest_blackout_h",
  "landing_sun_el_deg",
  "landing_lit",
  "slope_deg",
  "slope_baseline_m",
  "slope_source",
  "best_in",
  "notes",
] as const;

function columnNotes(column: ColumnView, rows: readonly MetricRow[], index: number): string {
  const notes = [...column.notes];
  if (column.chosenBy) notes.push(column.chosenBy);
  if (column.tier === "Terrain not modelled") notes.push("Terrain not modelled");
  for (const row of rows) for (const note of row.cells[index]?.notes ?? []) notes.push(note);
  if (column.status.kind === "loading") notes.push("Still loading");
  if (column.status.kind === "error") notes.push(`Could not load: ${column.status.message}`);
  if (column.status.kind === "none") notes.push("No result: the mission window runs past the end of the time grid");
  return notes.join("; ").replace(/ /g, " ");
}

/**
 * The table's rows as CSV rows: the printed numbers, as numbers. `statusBest` is "Sites and
 * dates"' best column, written as "column" in `best_in` (the Sites table marks the score).
 */
export function compareCsvRows(columns: readonly ColumnView[], rows: readonly MetricRow[], statusBest: readonly boolean[] | null = null): CsvValue[][] {
  const statuses = statusCells(columns);
  const row = (id: MetricRow["id"]) => rows.find((r) => r.id === id) as MetricRow;
  return columns.map((column, index) => {
    const status = statuses[index] ?? null;
    const m = (term: string) => metricNumber(column.metrics?.[term]);
    const site = column.site;
    const head = statusBest ? (statusBest[index] ? "column" : null) : status?.best ? "score" : null;
    const best = [head, ...rows.map((r) => (r.cells[index]?.best ? r.id : null))].filter(Boolean).join(" ");
    const landingLit = column.metrics?.landing_lit?.value;
    return [
      column.siteId,
      column.name,
      site ? Number(site.lat_deg.toFixed(4)) : null,
      site ? Number(site.lon_deg.toFixed(4)) : null,
      site?.terrain_tier ?? null,
      status?.status ?? null,
      status ? Number(status.scoreText) : null,
      status ? (status.used ? "yes" : "no: a broken rule decides") : null,
      column.rules ? column.rules.broken.map(brokenRuleText).join("; ").replace(/ /g, " ") || "none" : null,
      m("sun_fraction_mean"),
      m("lit_fraction"),
      m("longest_dark_h"),
      m("link_fraction"),
      m("longest_blackout_h"),
      m("landing_sun_el_deg"),
      landingLit === undefined ? null : landingLit,
      row("slope").cells[index]?.value ?? null,
      site?.slope?.baseline_m ?? null,
      site?.slope?.source ?? null,
      best,
      columnNotes(column, rows, index),
    ];
  });
}

export function compareCsv(columns: readonly ColumnView[], rows: readonly MetricRow[], scenario: ExportScenario, made: Date): string {
  return toCsv(
    headerComments(
      "TrueSouth comparison: one row per selected site. Values are as printed on screen (rounded); the JSON export holds full precision",
      scenario,
      made,
    ),
    COMPARE_CSV_HEADER,
    compareCsvRows(columns, rows),
  );
}

/** "Sites and dates": the CSV's columns, with each row's landing date after the site. */
export const DATES_CSV_HEADER = ["site_id", "site_name", "landing_utc", ...COMPARE_CSV_HEADER.slice(2)] as const;

/** "Sites and dates" as CSV: one row per site and landing date, A then B, date 1 then 2. */
export function datesCsv(
  columns: readonly ColumnView[],
  rows: readonly MetricRow[],
  best: readonly boolean[],
  scenario: ExportScenario,
  picks: DatesPicks,
  made: Date,
): string {
  const body = compareCsvRows(columns, rows, best).map((row, index) => [
    ...row.slice(0, 2),
    columns[index]?.landingUtc ?? null,
    ...row.slice(2),
  ]);
  return toCsv(
    headerComments(
      "TrueSouth comparison of two sites at two landing dates: one row per site and landing date. Values are as printed on screen (rounded); the JSON export holds full precision",
      scenario,
      made,
      picks,
    ),
    DATES_CSV_HEADER,
    body,
  );
}

/** The scenario and every selected site's result, at full precision. */
export function scenarioJson(
  columns: readonly ColumnView[],
  scenario: ExportScenario,
  made: Date,
  dates: { picks: DatesPicks; best: readonly boolean[] } | null = null,
): string {
  const statuses = statusCells(columns);
  const document = {
    format: "truesouth-scenario",
    format_version: 1,
    made_utc: utcSeconds(made),
    source: DATA_SOURCE,
    caveat: CAVEAT,
    link: scenario.link,
    time_grid: gridRange(scenario.grid),
    scenario: {
      profile: scenario.profile,
      based_on_preset: scenario.basePresetId,
      changed_fields: scenario.changedFields,
      site_ids: scenario.siteIds,
      focused_site_id: scenario.focusedSiteId,
      landing_utc: scenario.landingUtc,
      current_utc: scenario.currentUtc,
      view: scenario.view,
      mission_window: missionWindow(scenario.grid, scenario.landingUtc, scenario.profile.duration_days),
    },
    ...(dates
      ? {
          compare: {
            mode: "sites_and_dates",
            site_a: dates.picks.siteA,
            site_b: dates.picks.siteB,
            date_1_utc: dates.picks.date1,
            date_2_utc: dates.picks.date2,
            best_rule: "GO beats CAUTION beats NO-GO, then the higher printed score; ties all best; none when every column is NO-GO",
          },
        }
      : {}),
    limits: PROFILE_FIELDS.map((field) => ({
      field,
      label: fieldDef(field).label,
      value: scenario.profile[field],
      unit: fieldDef(field).unit === "°" ? "deg" : fieldDef(field).unit,
      provenance: provenanceOf(scenario.profile, field),
    })),
    results: columns.map((column, index) => {
      const e = column.evaluation;
      const site = column.site;
      return {
        site_id: column.siteId,
        site_name: column.name,
        ...(dates && column.landingUtc
          ? {
              landing_utc: column.landingUtc,
              mission_window: missionWindow(scenario.grid, column.landingUtc, scenario.profile.duration_days),
              best_column: dates.best[index] ?? false,
            }
          : {}),
        lat_deg: site?.lat_deg ?? null,
        lon_east_deg: site?.lon_deg ?? null,
        terrain_tier: site?.terrain_tier ?? null,
        variant_of: site?.variant_of ?? null,
        offset_m: site?.offset_m ?? null,
        nearby_sun: site?.nearby_sun ?? null,
        result: column.status.kind === "ready" ? "ready" : column.status.kind,
        status: e?.status ?? null,
        score_of_100: e?.score ?? null,
        score_shown: statuses[index]?.scoreText ?? null,
        score_used: e ? e.status !== "NO-GO" : null,
        metrics: e
          ? {
              sun_fraction_mean: e.metrics.sunFractionMean,
              lit_fraction: e.metrics.litFraction,
              longest_dark_h: e.metrics.longestDarkH,
              link_fraction: e.metrics.linkFraction,
              longest_blackout_h: e.metrics.longestBlackoutH,
              landing_sun_el_deg: e.metrics.landingSunElDeg,
              landing_lit: e.metrics.landingLit,
            }
          : null,
        vetoes: e?.vetoes ?? null,
        broken_rules: column.rules?.broken.map((rule) => rule.id) ?? null,
        utilities: e?.utilities ?? null,
        slope_not_assessed: e?.slopeNotAssessed ?? null,
        slope: site?.slope ?? null,
        notes: [...column.notes, ...(column.chosenBy ? [column.chosenBy] : [])],
      };
    }),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function compareFileName(scenario: Pick<ExportScenario, "profile" | "landingUtc">): string {
  return `truesouth_compare_${fileProfile(scenario.profile)}_${fileDate(scenario.landingUtc)}.csv`;
}

export function scenarioFileName(scenario: Pick<ExportScenario, "profile" | "landingUtc">): string {
  return `truesouth_scenario_${fileProfile(scenario.profile)}_${fileDate(scenario.landingUtc)}.json`;
}

/** "Sites and dates" file names: the profile and both landing dates. */
export function datesFileName(scenario: Pick<ExportScenario, "profile">, picks: DatesPicks, extension: "csv" | "json"): string {
  return `truesouth_compare_dates_${fileProfile(scenario.profile)}_${fileDate(picks.date1)}_${fileDate(picks.date2)}.${extension}`;
}
