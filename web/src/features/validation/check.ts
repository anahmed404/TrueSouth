/**
 * Checks validation.json for everything the page reads, before anything is drawn.
 *
 * The data layer's `parseValidation` checks the file's outline. This goes further: every
 * field each section prints, gate by gate and row by row, so a damaged record can never
 * print "NaN", "undefined" or "null".
 *
 * - A file without its outline (generated_utc, gates, comparisons) is not usable: the page
 *   then says "Validation has not been run on this build".
 * - A gate or comparison row that is incomplete is kept, in its place, as a broken
 *   record with whatever id and name it has. It is shown as incomplete and is never
 *   counted as passed.
 * - A G2 chart series that is incomplete is left out of the chart, and the page says how
 *   many were left out. A missing value inside a series is a gap in the line.
 */
import type { Comparison, DataSource, Gate } from "../../contracts/generated.ts";

/** A gate or comparison whose record lacks something the page needs. */
export type BrokenRecord = {
  kind: "broken";
  /** Its id, when the record has a usable one. */
  id: string | null;
  /** Its name (a gate) or site id (a comparison), when the record has one. */
  name: string | null;
};

export type GateItem = { kind: "gate"; gate: Gate } | BrokenRecord;

export type ComparisonItem = { kind: "comparison"; comparison: Comparison } | BrokenRecord;

/** One G2 chart series. A value the file leaves out is null: a gap in the line. */
export type G2Series = {
  site_id: string;
  body: "sun" | "earth";
  start_utc: string;
  step_h: number;
  max_difference_deg: (number | null)[];
};

export type CheckedReport = {
  generated_utc: string;
  gates: GateItem[];
  comparisons: ComparisonItem[];
  g2_over_time: G2Series[];
  /** Chart series left out because they were incomplete. */
  brokenSeries: number;
  sources: DataSource[];
  /** Sources left out because they had no name or link. */
  brokenSources: number;
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

function isUtc(value: unknown): value is string {
  return typeof value === "string" && UTC.test(value) && Number.isFinite(Date.parse(value));
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function broken(record: Json | unknown, nameField: string): BrokenRecord {
  const source = isObject(record) ? record : {};
  return {
    kind: "broken",
    id: isText(source.id) ? source.id : null,
    name: isText(source[nameField]) ? (source[nameField] as string) : null,
  };
}

/** A gate the page can print, or a broken record. */
export function checkGate(value: unknown): GateItem {
  if (!isObject(value)) return broken(value, "name");
  const { id, name, limit, unit, samples, passed, measured } = value;
  const shapeOk = isText(id) && isText(name) && isNumber(limit) && typeof unit === "string" && isNumber(samples) && samples >= 0;
  // A measured gate has a boolean result and a number; an unmeasured one has neither.
  const resultOk =
    (typeof passed === "boolean" && isNumber(measured)) || (passed === null && measured === null);
  if (!shapeOk || !resultOk) return broken(value, "name");
  return {
    kind: "gate",
    gate: { id, name, limit, unit, samples, passed, measured, detail: optionalText(value.detail) } as Gate,
  };
}

/** A comparison row the page can print, or a broken record. */
export function checkComparison(value: unknown): ComparisonItem {
  if (!isObject(value)) return broken(value, "site_id");
  const { id, site_id, ours, reference, investigate_above, outside_mark, unit } = value;
  const ok =
    isText(id) &&
    isText(site_id) &&
    isNumber(ours) &&
    isNumber(reference) &&
    isNumber(investigate_above) &&
    investigate_above >= 0 &&
    typeof outside_mark === "boolean" &&
    isText(unit);
  if (!ok) return broken(value, "site_id");
  return {
    kind: "comparison",
    comparison: {
      id,
      site_id,
      ours,
      reference,
      investigate_above,
      outside_mark,
      unit,
      reference_source: typeof value.reference_source === "string" ? value.reference_source : "",
      explanation: optionalText(value.explanation),
    },
  };
}

/** A chart series the page can draw, or null. Values that are not numbers become gaps. */
export function checkSeries(value: unknown): G2Series | null {
  if (!isObject(value)) return null;
  const { site_id, body, start_utc, step_h, max_difference_deg } = value;
  if (!isText(site_id) || (body !== "sun" && body !== "earth") || !isUtc(start_utc)) return null;
  if (!isNumber(step_h) || step_h <= 0 || !Array.isArray(max_difference_deg)) return null;
  return {
    site_id,
    body,
    start_utc,
    step_h,
    max_difference_deg: max_difference_deg.map((item) => (isNumber(item) ? item : null)),
  };
}

function checkSource(value: unknown): DataSource | null {
  if (!isObject(value) || !isText(value.name) || !isText(value.url)) return null;
  return { name: value.name, url: value.url, used_for: optionalText(value.used_for) ?? "" };
}

/** The report the page draws, or null when the file's outline is not there. */
export function checkReport(value: unknown): CheckedReport | null {
  if (!isObject(value)) return null;
  const { generated_utc, gates, comparisons } = value;
  if (!isUtc(generated_utc) || !Array.isArray(gates) || !Array.isArray(comparisons)) return null;
  const rawSeries = value.g2_over_time ?? [];
  const rawSources = value.sources ?? [];
  if (!Array.isArray(rawSeries) || !Array.isArray(rawSources)) return null;

  const series = rawSeries.map(checkSeries);
  const sources = rawSources.map(checkSource);
  return {
    generated_utc,
    gates: gates.map(checkGate),
    comparisons: comparisons.map(checkComparison),
    g2_over_time: series.filter((item): item is G2Series => item !== null),
    brokenSeries: series.filter((item) => item === null).length,
    sources: sources.filter((item): item is DataSource => item !== null),
    brokenSources: sources.filter((item) => item === null).length,
  };
}

export const INCOMPLETE_MESSAGE = "This check's record is incomplete in this build";
