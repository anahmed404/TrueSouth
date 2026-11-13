/**
 * How a worked-example value is written in lesson and card text. This is the one place the
 * Academy rounds a number from `worked_examples.json`.
 *
 * The rule, by the key's unit suffix (the suffixes `worked_examples.json` uses):
 *
 * | Key ends in                                   | Unit    | At most     |
 * | :-------------------------------------------- | :------ | :---------- |
 * | `_deg`, `_lat`, `_lon`, `_az`, `_el`, `_clear` | degrees | 2 decimals  |
 * | `_km`                                         | km      | 1 decimal   |
 * | `_m`                                          | metres  | 0 decimals  |
 * | `_h`                                          | hours   | 1 decimal   |
 * | `_pct`                                        | percent | 0 decimals  |
 * | anything else                                 | —       | 2 decimals  |
 *
 * Trailing zeros are dropped, so the data's own precision shows and no extra is invented
 * (2.0 is written 2, 1.86 stays 1.86). Thousands are grouped with a comma (4,864). A
 * negative number takes a true minus sign (−0.5), and a value that rounds to zero loses
 * its sign. The frontend only formats here; it never computes a result.
 *
 * Units are not added: lesson text writes its unit after the placeholder, as in
 * `{{example.l3.drop_at_20km_m}} m`.
 */

/** A value in `worked_examples.json`. */
export type ExampleValue = string | number | boolean | readonly (string | number)[];

const DECIMALS: readonly (readonly [RegExp, number])[] = [
  [/_(deg|lat|lon|az|el|clear)$/, 2],
  [/_km$/, 1],
  [/_m$/, 0],
  [/_h$/, 1],
  [/_pct$/, 0],
];

const DEFAULT_DECIMALS = 2;

/** The most decimals a key's number is written with. */
export function decimalsFor(key: string): number {
  for (const [pattern, decimals] of DECIMALS) {
    if (pattern.test(key)) return decimals;
  }
  return DEFAULT_DECIMALS;
}

const MINUS = "−";

/** Rounds to at most `decimals`, drops trailing zeros, groups thousands, uses a true minus. */
export function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return String(value);
  const factor = 10 ** decimals;
  let rounded = Math.round(Math.abs(value) * factor) / factor;
  if (value < 0) rounded = -rounded;
  if (rounded === 0) rounded = 0; // no "−0"
  const text = Math.abs(rounded).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
  return rounded < 0 ? `${MINUS}${text}` : text;
}

/** A worked-example value as text, by the rule above. */
export function formatExample(key: string, value: ExampleValue): string {
  if (typeof value === "number") return formatNumber(value, decimalsFor(key));
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value;
  return value.map((item) => (typeof item === "number" ? formatNumber(item, decimalsFor(key)) : item)).join(", ");
}
