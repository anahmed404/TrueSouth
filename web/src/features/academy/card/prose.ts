/**
 * Card text, split into the pieces the card draws. The syntax is described above
 * `UnderTheHoodCard` in `../types.ts`: `$…$` maths, `{{example.key}}` placeholders with
 * an optional unit after them, `{{compare:a,b|less|more|same}}` comparison words,
 * `[[term|label]]` glossary terms, and `` `code` ``.
 */
export type ProseToken =
  | { kind: "text"; text: string }
  | { kind: "math"; tex: string }
  | { kind: "code"; text: string }
  | { kind: "term"; term: string; label: string }
  | { kind: "fill"; key: string; unit: string }
  /** A word chosen from the data; `keys` and `words` are checked when drawn. */
  | { kind: "compare"; keys: string[]; words: string[] };

const TOKEN = new RegExp(
  [
    String.raw`\\\$`, // an escaped dollar sign
    String.raw`\$((?:\\\$|[^$])+)\$`, // $maths$
    "`([^`]+)`", // `code`
    String.raw`\[\[([a-z0-9_]+)(?:\|([^\]]+))?\]\]`, // [[term]] or [[term|label]]
    // {{example.…}}, then an optional unit kept with its number. Anything inside the
    // braces counts, so a malformed key shows as missing instead of leaking as text.
    String.raw`\{\{example\.([^{}]*)\}\}(°|%|[   ](?:km|m|h|UTC)(?![A-Za-z]))?`,
    // {{compare:keyA,keyB|word if A is less|word if A is more|word if they print the same}}
    String.raw`\{\{compare:([^{}]*)\}\}`,
  ].join("|"),
  "g",
);

/** A glossary key as words: "skyline_bin" → "skyline bin". */
export function termLabel(term: string): string {
  return term.split("_").join(" ");
}

/**
 * The unit as it is written after a number: degrees and percent attach, a word unit
 * follows a narrow no-break space (DESIGN.md, "Numbers and units").
 */
function normaliseUnit(unit: string | undefined): string {
  if (!unit) return "";
  if (unit === "°" || unit === "%") return unit;
  return ` ${unit.trim()}`;
}

export function parseProse(text: string): ProseToken[] {
  const tokens: ProseToken[] = [];
  let buffer = "";
  let last = 0;
  const flush = () => {
    if (buffer) tokens.push({ kind: "text", text: buffer });
    buffer = "";
  };
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    buffer += text.slice(last, index);
    last = index + match[0].length;
    const [whole, math, code, term, label, key, unit, compare] = match;
    if (whole === "\\$") {
      buffer += "$";
      continue;
    }
    flush();
    if (math !== undefined) tokens.push({ kind: "math", tex: math });
    else if (code !== undefined) tokens.push({ kind: "code", text: code });
    else if (term !== undefined) tokens.push({ kind: "term", term, label: label ?? termLabel(term) });
    else if (key !== undefined) tokens.push({ kind: "fill", key, unit: normaliseUnit(unit) });
    else if (compare !== undefined) {
      const [keys = "", ...words] = compare.split("|");
      tokens.push({ kind: "compare", keys: keys.split(",").map((item) => item.trim()), words });
    }
  }
  buffer += text.slice(last);
  flush();
  return tokens;
}

/** Every glossary term a piece of card text names. */
export function termsIn(text: string): string[] {
  return parseProse(text).flatMap((token) => (token.kind === "term" ? [token.term] : []));
}

/** Every example key a piece of card text names: placeholders, inside maths too, and comparisons. */
export function keysIn(text: string): string[] {
  return [...text.matchAll(/\{\{example\.([^{}]*)\}\}|\{\{compare:([^{}|]*)/g)].flatMap((match) =>
    match[1] !== undefined ? [match[1]] : (match[2] ?? "").split(",").map((item) => item.trim()),
  );
}

/** The key sets compared by `{{compare:…}}` in a piece of card text. */
export function comparedSetsIn(text: string): string[][] {
  return parseProse(text).flatMap((token) => (token.kind === "compare" && token.keys.length >= 2 ? [token.keys] : []));
}
