/**
 * How a worked-example value is written in lesson and card text. This is the one place the
 * Academy rounds a number from `worked_examples.json`. The frontend only formats here; it
 * never computes a result.
 *
 * Numbers follow the key's unit, read from the key's name:
 *
 * | Key                                               | Unit    | Decimals        |
 * | :------------------------------------------------ | :------ | :-------------- |
 * | ends `_deg`, `_lat`, `_lon`, `_az`, `_el`, `_clear` | degrees | at least 1, at most 2 |
 * | ends `_km`                                        | km      | at most 1       |
 * | ends `_m`                                         | metres  | none            |
 * | ends `_h`                                         | hours   | at most 1       |
 * | has a `_pct` segment (`_pct` or `_pct_…`)          | percent | none            |
 * | listed in `UNITLESS_KEYS` below                   | none    | as listed       |
 *
 * Angles always show at least one decimal (2.0°, 90.0°, 1.86°), as docs/tracks/README.md
 * asks. Other trailing zeros are dropped, so the data's own precision shows. Thousands are
 * grouped with a comma (4,864), a negative number takes a true minus sign (−0.5), and a
 * value that rounds to zero loses its sign.
 *
 * A numeric key that matches none of these falls back to at most 2 decimals, but
 * `format-example.test.ts` fails for any such key in the fixture or the contract type, so a
 * new key cannot silently get the wrong format: give it a unit suffix, or list it here.
 *
 * A value that is not usable (null, NaN, ±Infinity, an object, an empty string, an empty
 * list) formats to `null`, and the text shows the "value not built yet" chip instead.
 *
 * Units are not added: lesson text writes its unit after the placeholder, as in
 * `{{example.l3.drop_at_20km_m}} m`.
 */

/** A value in `worked_examples.json` that can be written. Anything else formats to null. */
export type ExampleValue = string | number | boolean | readonly (string | number)[];

export type Decimals = { min: number; max: number };

export type UnitRule = { unit: "deg" | "km" | "m" | "h" | "pct" | "none"; decimals: Decimals };

const BY_NAME: readonly (readonly [RegExp, UnitRule])[] = [
  [/_(deg|lat|lon|az|el|clear)$/, { unit: "deg", decimals: { min: 1, max: 2 } }],
  [/_km$/, { unit: "km", decimals: { min: 0, max: 1 } }],
  [/_m$/, { unit: "m", decimals: { min: 0, max: 0 } }],
  [/_h$/, { unit: "h", decimals: { min: 0, max: 1 } }],
  [/_pct(_|$)/, { unit: "pct", decimals: { min: 0, max: 0 } }],
];

/**
 * Numeric keys with no unit, each with its decimals. A key here has a value that is a
 * pure number: a share from 0 to 1, a score from 0 to 100, or a fitted coefficient.
 */
export const UNITLESS_KEYS: Readonly<Record<string, Decimals>> = {
  // Disc fraction: the share of the Sun's disc above the skyline, 0 to 1.
  "l2.sun_frac": { min: 0, max: 2 },
  // Plane-fit coefficients: the plane's rise per metre of run east (a) and north (b).
  "l5.plane_a": { min: 0, max: 3 },
  "l5.plane_b": { min: 0, max: 3 },
  // Scores, 0 to 100.
  "l6.a_score": { min: 0, max: 1 },
  "l6.b_score": { min: 0, max: 1 },
  "l6.example_score": { min: 0, max: 1 },
  // Metrics that are shares of the mission window, 0 to 1.
  "l6.example_metrics.link_fraction": { min: 0, max: 2 },
  "l6.example_metrics.lit_fraction": { min: 0, max: 2 },
  "l6.example_metrics.sun_fraction_mean": { min: 0, max: 2 },
  // Utilities, 0 to 1.
  "l6.example_utilities.comms": { min: 0, max: 2 },
  "l6.example_utilities.power": { min: 0, max: 2 },
  "l6.example_utilities.slope": { min: 0, max: 2 },
};

const FALLBACK: Decimals = { min: 0, max: 2 };

/** The unit rule for a key, or null when its name matches no rule (the fallback applies). */
export function unitRuleFor(key: string): UnitRule | null {
  const listed = UNITLESS_KEYS[key];
  if (listed) return { unit: "none", decimals: listed };
  for (const [pattern, rule] of BY_NAME) {
    if (pattern.test(key)) return rule;
  }
  return null;
}

/** The decimals a key's number is written with. */
export function decimalsFor(key: string): Decimals {
  return unitRuleFor(key)?.decimals ?? FALLBACK;
}

const MINUS = "−";

/** Rounds to at most `max` decimals, keeps at least `min`, groups thousands, uses a true minus. */
export function formatNumber(value: number, decimals: Decimals | number): string {
  const { min, max } = typeof decimals === "number" ? { min: 0, max: decimals } : decimals;
  const factor = 10 ** max;
  let rounded = Math.round(Math.abs(value) * factor) / factor;
  if (value < 0) rounded = -rounded;
  if (rounded === 0) rounded = 0; // no "−0"
  const text = Math.abs(rounded).toLocaleString("en-GB", {
    minimumFractionDigits: Math.min(min, max),
    maximumFractionDigits: max,
    useGrouping: true,
  });
  return rounded < 0 ? `${MINUS}${text}` : text;
}

/** True for a value that can be written: a finite number, non-empty text, yes/no, or a non-empty list of those. */
export function isUsableExample(value: unknown): value is ExampleValue {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.every((item) => (typeof item === "number" ? Number.isFinite(item) : typeof item === "string" && item.trim() !== ""))
    );
  }
  return false;
}

/**
 * A worked-example value as text, by the rule above, or `null` when it is not usable.
 * `decimals` overrides the key's own rule, for a compared set (see `compare.ts`).
 */
export function formatExample(key: string, value: unknown, decimals?: Decimals): string | null {
  if (!isUsableExample(value)) return null;
  const rule = decimals ?? decimalsFor(key);
  if (typeof value === "number") return formatNumber(value, rule);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return value;
  return value.map((item) => (typeof item === "number" ? formatNumber(item, rule) : item)).join(", ");
}
