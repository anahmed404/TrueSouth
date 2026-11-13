import type { Decimals } from "../format-example";
import { exampleText, splitPlaceholders, type WorkedExamples } from "../placeholders";

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

export type FillOptions = {
  /** The examples are still loading, so a missing key says "loading". */
  pending?: boolean;
  /** Decimals for keys in a compared set (see `../compare.ts`). */
  precision?: ReadonlyMap<string, Decimals>;
};

/**
 * Fills the `{{example.…}}` placeholders in a TeX string for KaTeX. Each value is wrapped
 * in `\htmlClass{ac-fill}{…}` so it draws as a `Fill` chip. A key that is missing,
 * malformed, or whose value is not usable becomes a dashed chip that says "value not built
 * yet" (or "loading" while `pending`). Text values are escaped into `\text{…}`, so a value
 * can never inject TeX or HTML. The raw `{{…}}` never reaches the page.
 */
export function fillTex(tex: string, examples: WorkedExamples, options: FillOptions = {}): FilledTex {
  const missing: string[] = [];
  const out = splitPlaceholders(tex).map((part) => {
    if (part.kind === "text") return part.text;
    const written = exampleText(examples, part.key, options.precision?.get(part.key));
    if (written === null) {
      missing.push(part.key);
      const words = options.pending ? PENDING_TEXT : MISSING_TEXT;
      return String.raw`\htmlClass{${FILL_CLASS} ${FILL_CLASS}--missing}{\text{${words}}}`;
    }
    return String.raw`\htmlClass{${FILL_CLASS}}{${valueAsTex(written, typeof examples[part.key] === "number")}}`;
  });
  return { tex: out.join(""), missing };
}
