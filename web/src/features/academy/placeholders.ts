import { formatExample, isUsableExample, type Decimals } from "./format-example";

/**
 * Anything shaped like `{{example.…}}` is a placeholder, whatever is inside, so a mistyped
 * key such as `{{example.l.bad-key}}` shows as a missing value instead of leaking as raw
 * text. Other `{{…}}` text (a TeX group, say) is left alone.
 */
const PLACEHOLDER = /\{\{example\.([^{}]*)\}\}/g;

/** The shape of a real key: dot-separated words of letters, digits and underscores. */
const VALID_KEY = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;

/**
 * A worked-examples object. Keys match `{{example.key}}`, and may contain dots. Values come
 * from `worked_examples.json`, so they are checked when used, never trusted to be usable.
 */
export type WorkedExamples = Readonly<Record<string, unknown>>;

/** True when `examples` has a usable value for `key` (see `isUsableExample`). */
export function hasExample(examples: WorkedExamples, key: string): boolean {
  return VALID_KEY.test(key) && Object.prototype.hasOwnProperty.call(examples, key) && isUsableExample(examples[key]);
}

/**
 * The value for `key` written as text by the rule in `format-example.ts`, or `null` when the
 * key is malformed, absent, or its value is not usable. `decimals` overrides the key's rule.
 */
export function exampleText(examples: WorkedExamples, key: string, decimals?: Decimals): string | null {
  if (!hasExample(examples, key)) return null;
  return formatExample(key, examples[key], decimals);
}

/** A piece of text: plain text, or a `{{example.key}}` placeholder. */
export type PlaceholderPart = { kind: "text"; text: string } | { kind: "key"; key: string };

/** Splits text around its `{{example.…}}` placeholders, in order. */
export function splitPlaceholders(text: string): PlaceholderPart[] {
  const parts: PlaceholderPart[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", text: text.slice(last, index) });
    parts.push({ kind: "key", key: match[1] ?? "" });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

export type FilledText = {
  text: string;
  missing: string[];
};

/**
 * Fills `{{example.key}}` from a worked-examples object, written by the rounding rule in
 * `format-example.ts`. A missing key is left in place and reported, once per occurrence.
 */
export function fillPlaceholders(text: string, examples: WorkedExamples): FilledText {
  const missing: string[] = [];
  const filled = text.replace(PLACEHOLDER, (token, key: string) => {
    const written = exampleText(examples, key);
    if (written === null) {
      missing.push(key);
      return token;
    }
    return written;
  });
  return { text: filled, missing };
}

const WHOLE_PLACEHOLDER = /^\{\{example\.([^{}]*)\}\}$/;

export type ResolvedValue = {
  /** The filled value, or null when its key is missing. */
  value: number | string | null;
  missing: string[];
};

/**
 * Fills a value that is a whole `{{example.key}}` placeholder, keeping its type: a number
 * stays a number and text stays text; yes/no and lists become their written form. Any other
 * value is returned as it is. A missing key, or one whose value is not usable, gives `null`.
 */
export function resolveValue(value: number | string, examples: WorkedExamples): ResolvedValue {
  if (typeof value === "number") return { value, missing: [] };
  const match = WHOLE_PLACEHOLDER.exec(value);
  if (!match) return { value, missing: [] };
  const key = match[1] ?? "";
  if (!hasExample(examples, key)) return { value: null, missing: [key] };
  const found = examples[key];
  if (typeof found === "number" || typeof found === "string") return { value: found, missing: [] };
  return { value: exampleText(examples, key), missing: [] };
}

/**
 * Resolves a value that should be a number of degrees, such as a sky-ruler angle.
 * Returns null when the key is missing or the value is not a finite number.
 */
export function resolveDegrees(value: number | string | null, examples: WorkedExamples): number | null {
  if (value === null) return null;
  const resolved = resolveValue(value, examples).value;
  if (typeof resolved === "number") return Number.isFinite(resolved) ? resolved : null;
  if (typeof resolved === "string" && resolved.trim() !== "") {
    const parsed = Number(resolved);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
