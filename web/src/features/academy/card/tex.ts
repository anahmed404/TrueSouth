import { formatExample } from "../format-example";
import { hasExample, splitPlaceholders, type WorkedExamples } from "../placeholders";

/** The chip's words for a key that `worked_examples.json` does not have yet. */
export const MISSING_TEXT = "value not built yet";

/** The chip's words while `worked_examples.json` is still loading. */
export const PENDING_TEXT = "loading";

/** The class KaTeX gives a filled number, so it draws as the `Fill` chip. */
export const FILL_CLASS = "ac-fill";

const TEXT_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
};

/** Text made safe inside `\text{…}`. */
export function escapeTexText(text: string): string {
  return text.replace(/[\\{}$&#^_%~]/g, (char) => TEXT_ESCAPES[char] ?? char);
}

/**
 * A formatted value written as TeX. A number stays maths: a plain hyphen for the minus
 * (TeX draws it as a minus) and `{,}` for the thousands comma so TeX adds no space after
 * it. Anything else is set as text.
 */
export function valueAsTex(formatted: string, isNumber: boolean): string {
  if (isNumber) return formatted.replace("−", "-").replaceAll(",", "{,}");
  return `\\text{${escapeTexText(formatted)}}`;
}

export type FilledTex = {
  tex: string;
  missing: string[];
};

/**
 * Fills the `{{example.key}}` placeholders in a TeX string for KaTeX. Each value is
 * wrapped in `\htmlClass{ac-fill}{…}` so it draws as a `Fill` chip; a missing key becomes
 * a dashed chip that says "value not built yet". While `pending` (the examples are still
 * loading) a missing key says "loading" instead. The raw `{{…}}` never reaches the page.
 */
export function fillTex(tex: string, examples: WorkedExamples, pending = false): FilledTex {
  const missing: string[] = [];
  const out = splitPlaceholders(tex).map((part) => {
    if (part.kind === "text") return part.text;
    const value = examples[part.key];
    if (!hasExample(examples, part.key) || value === undefined) {
      missing.push(part.key);
      const words = pending ? PENDING_TEXT : MISSING_TEXT;
      return `\\htmlClass{${FILL_CLASS} ${FILL_CLASS}--missing}{\\text{${words}}}`;
    }
    return `\\htmlClass{${FILL_CLASS}}{${valueAsTex(formatExample(part.key, value), typeof value === "number")}}`;
  });
  return { tex: out.join(""), missing };
}
