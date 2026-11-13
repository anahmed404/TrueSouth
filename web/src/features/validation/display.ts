/**
 * What the page prints for each gate and comparison value, with the rounding mode each
 * one needs (format.ts). Kept apart from the components so a test can check, for every
 * gate and comparison in both data files, that the printed numbers agree with the
 * printed result.
 */
import type { Gate } from "../../contracts/generated.ts";
import { formatFixed, formatPercent, formatPoints, formatSignedDegrees, formatValue, withUnit } from "./format";
import { isSelfComparison, type ComparisonRow } from "./model";

// ── Gates ────────────────────────────────────────────────────────────────────

/** A limit is printed as the file gives it. */
export function gateLimitText(gate: Gate): string {
  return withUnit(formatValue(gate.limit, { sig: 3 }), gate.unit);
}

/** A gate's measured value is a largest error: rounded up, and kept on its side of the limit. */
export function gateMeasuredText(gate: Gate & { measured: number }): string {
  return withUnit(formatValue(gate.measured, { round: "up", against: gate.limit }), gate.unit);
}

/** A largest difference in degrees read against G2's limit: the chart caption and by-year table. */
export function largestDegreesText(value: number, limit: number): string {
  return withUnit(formatValue(value, { round: "up", against: limit }), "deg");
}

// ── Comparisons ──────────────────────────────────────────────────────────────

/** Percentages for fractions; degrees to 2 decimals, or 3 when the mark is under 0.1°. */
export type ValueKind = "percent" | "degrees" | "fine-degrees";

export function kindOf(rows: readonly ComparisonRow[]): ValueKind {
  const first = rows[0];
  if (!first || first.unit === "fraction") return "percent";
  return first.mark < 0.1 ? "fine-degrees" : "degrees";
}

function decimals(kind: ValueKind): number {
  return kind === "fine-degrees" ? 3 : 2;
}

/** Our value or NASA's: an ordinary reading, rounded to nearest. */
export function readingText(value: number, kind: ValueKind): string {
  return kind === "percent" ? formatPercent(value) : `${formatFixed(value, decimals(kind))}°`;
}

/**
 * The amount read against the mark: ours minus NASA's, or, for a comparison with
 * ourselves (R5, R6), our value itself. Rounded up in size and kept on its side of the mark.
 */
export function measureText(row: ComparisonRow, kind: ValueKind): string {
  const self = isSelfComparison(row.id);
  const value = self ? row.ours : row.difference;
  const options = { round: "up" as const, against: row.mark };
  if (kind === "percent") {
    return self ? formatPercent(value, 1, options) : `${formatPoints(value, 1, options)} points`;
  }
  return self ? `${formatFixed(value, decimals(kind), options)}°` : formatSignedDegrees(value, decimals(kind), options);
}

/** The mark, as the file gives it: "10 percentage points", "2°", "0.05°". */
export function markText(mark: number, kind: ValueKind): string {
  return kind === "percent"
    ? `${formatValue(mark * 100, { sig: 3 })} percentage points`
    : withUnit(formatValue(mark, { sig: 3 }), "deg");
}
