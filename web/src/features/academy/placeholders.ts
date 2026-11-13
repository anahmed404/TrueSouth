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
