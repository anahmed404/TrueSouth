import { decimalsFor, formatNumber, type Decimals } from "./format-example";
import { hasExample, type WorkedExamples } from "./placeholders";

/**
 * Comparing worked-example numbers in text, so a sentence never contradicts its numbers.
 *
 * - A **compared set** is two or more keys printed with shared decimals. Starting from the
 *   keys' own rule, the set gains a decimal at a time, up to `MAX_COMPARE_DECIMALS`, until
 *   values that differ print differently: 1.864° and 1.861° print as 1.864° and 1.861°,
 *   not both as 1.86°. Equal values print the same.
 * - A **comparison word** is chosen from the data, never typed: "lower than", "higher than"
 *   or "as high as", by comparing the two values as they are printed. So the word always
 *   agrees with the numbers beside it. Two values that differ by less than the last printed
 *   decimal at the cap (0.0001) print the same and read as the same.
 */

export const MAX_COMPARE_DECIMALS = 4;

/** The numeric values of `keys` that are present and usable, in order. */
function numbersOf(keys: readonly string[], examples: WorkedExamples): number[] {
  return keys.flatMap((key) => {
    const value = examples[key];
    return hasExample(examples, key) && typeof value === "number" ? [value] : [];
  });
}

/** Rounds to a whole number of decimals exactly as `formatNumber` prints it (half away from zero). */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  return value < 0 ? -rounded : rounded;
}

/**
 * The shared decimals for a compared set: at least each key's own minimum, and the fewest
 * maximum decimals (from the keys' own, up to `MAX_COMPARE_DECIMALS`) at which every pair
 * of unequal values prints differently.
 */
export function comparedDecimals(keys: readonly string[], examples: WorkedExamples): Decimals {
  const rules = keys.map(decimalsFor);
  const min = Math.max(0, ...rules.map((rule) => rule.min));
  const start = Math.max(0, ...rules.map((rule) => rule.max));
  const values = numbersOf(keys, examples);
  const distinct = new Set(values).size;
  let max = start;
  while (max < MAX_COMPARE_DECIMALS && new Set(values.map((value) => formatNumber(value, { min, max }))).size < distinct) {
    max += 1;
  }
  return { min: Math.min(min, max), max };
}

/** The decimals for every key in any compared set; a key in two sets takes the larger. */
export function precisionFor(sets: readonly (readonly string[])[], examples: WorkedExamples): Map<string, Decimals> {
  const precision = new Map<string, Decimals>();
  for (const set of sets) {
    const decimals = comparedDecimals(set, examples);
    for (const key of set) {
      const known = precision.get(key);
      precision.set(key, known && known.max >= decimals.max ? known : decimals);
    }
  }
  return precision;
}

export type ComparisonWords = {
  /** Said when the first value is smaller, such as "lower than". */
  less: string;
  /** Said when the first value is larger, such as "higher than". */
  more: string;
  /** Said when the two print the same, such as "as high as". */
  same: string;
};

/**
 * The word that compares the value of `first` with `second`, as they print with `decimals`
 * (the pair's compared-set decimals when not given). `null` when either is missing or not a
 * number.
 */
export function comparisonWord(
  examples: WorkedExamples,
  first: string,
  second: string,
  words: ComparisonWords,
  decimals?: Decimals,
): string | null {
  const a = examples[first];
  const b = examples[second];
  if (!hasExample(examples, first) || !hasExample(examples, second)) return null;
  if (typeof a !== "number" || typeof b !== "number") return null;
  const { max } = decimals ?? comparedDecimals([first, second], examples);
  const ra = roundTo(a, max);
  const rb = roundTo(b, max);
  if (ra < rb) return words.less;
  if (ra > rb) return words.more;
  return words.same;
}
