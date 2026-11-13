/**
 * Number display for the validation page. Display only: the values come from
 * validation.json and are only rounded here.
 *
 * Three rounding modes, so a displayed number never makes a result look better than the
 * file says:
 * - "up": a largest difference, an upper bound or a "within X". Rounded away from zero
 *   at the shown precision, so 0.006007° shows as 0.0061°, never 0.006°.
 * - "down": a lower bound or a minimum. Rounded towards zero.
 * - "nearest": an ordinary reading, such as our value or NASA's.
 *
 * `against`: a limit or mark the value is read against. Figures are added until the
 * shown value sits on the same side of it as the true value (under, equal or over), so
 * 0.0049996 against a limit of 0.005 never reads "0.005", and a value over its limit
 * never reads as equal to it.
 *
 * Gate values run from about 10⁻¹³ to 10⁻², so small values are written "3.1 × 10⁻⁹".
 */
import { MINUS } from "../../components/format";
import { unitSymbol } from "./model";

export type Rounding = "up" | "down" | "nearest";

type RoundOptions = {
  round?: Rounding;
  /** A limit or mark: the shown value keeps the true value's side of it. */
  against?: number;
};

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

function superscript(text: string): string {
  return [...text].map((char) => SUPERSCRIPT[char] ?? char).join("");
}

/** Below this, a value is written with a power of ten. */
const SMALL = 1e-3;
/** The most decimals or figures a value is given while it is made to agree with its limit. */
const MOST = 15;

/**
 * Rounds a magnitude (a value of zero or more) at `decimals` decimal places.
 * Binary noise is removed first, so 0.1 × 100 rounds up to 10, not 10.1.
 */
function roundMagnitude(size: number, decimals: number, mode: Rounding): number {
  const factor = 10 ** decimals;
  const scaled = Number((size * factor).toPrecision(12));
  const whole = mode === "up" ? Math.ceil(scaled) : mode === "down" ? Math.floor(scaled) : Math.round(scaled);
  return whole / factor;
}

/** A signed value rounded at `decimals` places; "up" and "down" act on its size. */
export function roundAt(value: number, decimals: number, mode: Rounding): number {
  const rounded = roundMagnitude(Math.abs(value), decimals, mode);
  return value < 0 ? -rounded : rounded;
}

function side(value: number, against: number): number {
  return Math.sign(Math.abs(value) - Math.abs(against));
}

function agrees(shown: number, value: number, against: number | undefined): boolean {
  return against === undefined || side(shown, against) === side(value, against);
}

function withSign(text: string, negative: boolean): string {
  return negative ? `${MINUS}${text}` : text;
}

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

/** One attempt at `figures` significant figures: the text and the number it shows. */
function significant(size: number, figures: number, mode: Rounding): { text: string; shown: number } {
  if (size < SMALL) {
    let exponent = Math.floor(Math.log10(size));
    let mantissa = roundMagnitude(size / 10 ** exponent, figures - 1, mode);
    if (mantissa >= 10) {
      mantissa /= 10;
      exponent += 1;
    }
    const text = `${trimZeros(mantissa.toFixed(figures - 1))} × 10${superscript(String(exponent))}`;
    return { text, shown: Number(`${mantissa}e${exponent}`) };
  }
  const decimals = Math.max(0, figures - 1 - Math.floor(Math.log10(size)));
  const shown = roundMagnitude(size, decimals, mode);
  return { text: trimZeros(shown.toFixed(decimals)), shown };
}

/**
 * A measured value or a limit, with `sig` significant figures (2 by default) and trailing
 * zeros dropped: 0.02 → "0.02", 3.0886e-9 → "3.1 × 10⁻⁹".
 */
export function formatValue(value: number, options: RoundOptions & { sig?: number } = {}): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const mode = options.round ?? "nearest";
  const size = Math.abs(value);
  let attempt = significant(size, options.sig ?? 2, mode);
  for (let figures = (options.sig ?? 2) + 1; figures <= MOST && !agrees(attempt.shown, size, options.against); figures++) {
    attempt = significant(size, figures, mode);
  }
  return withSign(attempt.text, value < 0);
}

/**
 * A value with fixed decimals, for table columns: 0.7468 at 2 → "0.75". Decimals are
 * added only when they are needed to keep the value's side of `against`.
 */
export function formatFixed(value: number, decimals: number, options: RoundOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  const mode = options.round ?? "nearest";
  const size = Math.abs(value);
  let places = decimals;
  let shown = roundMagnitude(size, places, mode);
  while (places < MOST && !agrees(shown, size, options.against)) {
    places += 1;
    shown = roundMagnitude(size, places, mode);
  }
  return withSign(shown.toFixed(places), value < 0 && shown !== 0);
}

/** A value with its unit: "0.0061°", "3.1 × 10⁻⁹ m", "0.0013". */
export function withUnit(text: string, unit: string): string {
  const symbol = unitSymbol(unit);
  if (symbol === "") return text;
  if (symbol === "°") return `${text}°`;
  // A narrow no-break space between a number and its unit (DESIGN.md, "Numbers and units").
  return `${text} ${symbol}`;
}

function plus(text: string, value: number): string {
  return value > 0 && /[1-9]/.test(text) ? `+${text}` : text;
}

/** A fraction of 1 as a percentage: 0.5986 → "59.9%". A reading, so nearest by default. */
export function formatPercent(fraction: number, decimals = 1, options: RoundOptions = {}): string {
  const against = options.against === undefined ? undefined : options.against * 100;
  return `${formatFixed(fraction * 100, decimals, { ...options, against })}%`;
}

/** A difference of two fractions in percentage points, signed: 0.038 → "+3.8". */
export function formatPoints(difference: number, decimals = 1, options: RoundOptions = {}): string {
  const against = options.against === undefined ? undefined : options.against * 100;
  return plus(formatFixed(difference * 100, decimals, { ...options, against }), difference);
}

/** A signed difference in degrees: "+0.73°", "−1.23°". */
export function formatSignedDegrees(difference: number, decimals = 2, options: RoundOptions = {}): string {
  return `${plus(formatFixed(difference, decimals, options), difference)}°`;
}

/** An integer with thousands separators: 2103360 → "2,103,360". */
export function formatCount(count: number): string {
  return Math.round(count).toLocaleString("en-GB");
}
