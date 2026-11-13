/**
 * Number display for the validation page. Display only: the values come from
 * validation.json and are only rounded here.
 *
 * Gate values run from about 10⁻¹³ to 10⁻², so plain fixed decimals would print most of
 * them as "0.000". Small values are written as "3.1 × 10⁻⁹" instead.
 */
import { MINUS, formatNumber } from "../../components/format";
import { unitSymbol } from "./model";

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

function withSign(text: string, negative: boolean): string {
  return negative ? `${MINUS}${text}` : text;
}

/**
 * A measured value or a limit, with `sig` significant figures.
 *
 * `below`: when the value is under this limit, figures are added until the rounded text
 * is under it too, so 0.0049996 against a limit of 0.005 reads "0.0049996", never "0.0050".
 */
export function formatValue(value: number, options: { sig?: number; below?: number } = {}): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const sig = options.sig ?? 2;
  const negative = value < 0;
  const size = Math.abs(value);
  const limit = options.below;

  for (let figures = sig; figures <= 8; figures++) {
    let text: string;
    let shown: number;
    if (size < SMALL) {
      const [mantissa = "0", exponent = "0"] = size.toExponential(figures - 1).split("e");
      const cleanMantissa = mantissa.replace(/\.?0+$/, "");
      const cleanExponent = String(Number(exponent));
      text = `${cleanMantissa} × 10${superscript(cleanExponent)}`;
      shown = Number(`${mantissa}e${exponent}`);
    } else {
      text = size.toPrecision(figures);
      if (text.includes("e")) text = String(Number(text));
      shown = Number(text);
      // "0.020" reads as "0.02": significant figures, not trailing zeros.
      if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
    }
    const clashes = limit !== undefined && size < Math.abs(limit) && shown >= Math.abs(limit);
    if (!clashes || figures === 8) return withSign(text, negative);
  }
  return withSign(String(size), negative);
}

/** A value with its unit: "0.0060°", "3.1 × 10⁻⁹ m", "0.0013". */
export function withUnit(text: string, unit: string): string {
  const symbol = unitSymbol(unit);
  if (symbol === "") return text;
  if (symbol === "°") return `${text}°`;
  // A narrow no-break space between a number and its unit (DESIGN.md, "Numbers and units").
  return `${text} ${symbol}`;
}

/** A fraction of 1 as a percentage: 0.5986 → "59.9%". */
export function formatPercent(fraction: number, decimals = 1): string {
  return `${formatNumber(fraction * 100, decimals)}%`;
}

/** A difference of two fractions in percentage points, signed: 0.038 → "+3.8". */
export function formatPoints(difference: number, decimals = 1): string {
  const text = formatNumber(difference * 100, decimals);
  return difference > 0 && Number(text) !== 0 ? `+${text}` : text;
}

/** A signed difference in degrees: "+0.73°", "−1.23°". */
export function formatSignedDegrees(difference: number, decimals = 2): string {
  const text = formatNumber(difference, decimals);
  return `${difference > 0 && Number(text) !== 0 ? "+" : ""}${text}°`;
}

/** An integer with thousands separators: 2103360 → "2,103,360". */
export function formatCount(count: number): string {
  return Math.round(count).toLocaleString("en-GB");
}
