/**
 * Small display helpers shared by the interface components. Display only: no science,
 * no scoring.
 */

/** The typographic minus sign, so negative numbers line up with tabular figures. */
export const MINUS = "−";

/**
 * A number for display: fixed decimals, a real minus sign, and no "-0".
 * `formatNumber(-89.45551, 4)` is "−89.4555".
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = Math.abs(value).toFixed(decimals);
  const isZero = Number(fixed) === 0;
  return value < 0 && !isZero ? `${MINUS}${fixed}` : fixed;
}

/**
 * A UTC timestamp for display: "2028-03-01 00:00 UTC". Accepts ISO-8601 strings that end
 * in "Z". Anything else is returned unchanged, so a bad value is visible, not hidden.
 */
export function formatUtc(iso: string, options: { withZone?: boolean } = {}): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z$/.exec(iso);
  if (!match) return iso;
  const [, date, hours, minutes] = match;
  const text = `${date} ${hours}:${minutes}`;
  return options.withZone === false ? text : `${text} UTC`;
}

/** Joins class names, skipping empty ones. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

/**
 * The first sentence of a plain-language text: everything up to the first full stop,
 * question mark or exclamation mark that is followed by a space and a capital letter.
 */
export function firstSentence(text: string): string {
  const match = /^[\s\S]*?[.!?](?=\s+[A-Z(“"'])/.exec(text);
  return (match ? match[0] : text).trim();
}
