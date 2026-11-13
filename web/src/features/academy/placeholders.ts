const PLACEHOLDER = /\{\{example\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}/g;

/** A worked-examples object. Keys match `{{example.key}}`, and may contain dots. */
export type WorkedExamples = Readonly<Record<string, string | number>>;

export type FilledText = {
  text: string;
  missing: string[];
};

/**
 * Fills `{{example.key}}` from a worked-examples object.
 * A missing key is left in place and reported, once per occurrence.
 */
export function fillPlaceholders(text: string, examples: WorkedExamples): FilledText {
  const missing: string[] = [];
  const filled = text.replace(PLACEHOLDER, (token, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(examples, key)) {
      missing.push(key);
      return token;
    }
    const value = examples[key];
    if (value === undefined) {
      missing.push(key);
      return token;
    }
    return String(value);
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
 * stays a number. Any other value is returned as it is. A missing key gives `null`.
 */
export function resolveValue(value: number | string, examples: WorkedExamples): ResolvedValue {
  if (typeof value === "number") return { value, missing: [] };
  const match = WHOLE_PLACEHOLDER.exec(value);
  if (!match) return { value, missing: [] };
  const key = match[1] ?? "";
  if (!Object.prototype.hasOwnProperty.call(examples, key) || examples[key] === undefined) {
    return { value: null, missing: [key] };
  }
  return { value: examples[key] ?? null, missing: [] };
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
