import { formatExample, type ExampleValue } from "./format-example";

const PLACEHOLDER = /\{\{example\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}/g;

/**
 * A worked-examples object. Keys match `{{example.key}}`, and may contain dots. Values are
 * as in `worked_examples.json`: numbers, text, yes/no, or lists.
 */
export type WorkedExamples = Readonly<Record<string, ExampleValue>>;

/** True when `examples` has a value for `key`. */
export function hasExample(examples: WorkedExamples, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(examples, key) && examples[key] !== undefined;
}

/** A piece of text: plain text, or a `{{example.key}}` placeholder. */
export type PlaceholderPart = { kind: "text"; text: string } | { kind: "key"; key: string };

/** Splits text around its `{{example.key}}` placeholders, in order. */
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
    const value = examples[key];
    if (!hasExample(examples, key) || value === undefined) {
      missing.push(key);
      return token;
    }
    return formatExample(key, value);
  });
  return { text: filled, missing };
}

const WHOLE_PLACEHOLDER = /^\{\{example\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}$/;

export type ResolvedValue = {
  /** The filled value, or null when its key is missing. */
  value: number | string | null;
  missing: string[];
};

/**
 * Fills a value that is a whole `{{example.key}}` placeholder, keeping its type: a number
 * stays a number and text stays text; yes/no and lists become their written form. Any other
 * value is returned as it is. A missing key gives `null`.
 */
export function resolveValue(value: number | string, examples: WorkedExamples): ResolvedValue {
  if (typeof value === "number") return { value, missing: [] };
  const match = WHOLE_PLACEHOLDER.exec(value);
  if (!match) return { value, missing: [] };
  const key = match[1] ?? "";
  const found = examples[key];
  if (!hasExample(examples, key) || found === undefined) {
    return { value: null, missing: [key] };
  }
  if (typeof found === "number" || typeof found === "string") return { value: found, missing: [] };
  return { value: formatExample(key, found), missing: [] };
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
