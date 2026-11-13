import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isExplainTerm } from "../../../lib/explain";
import { sampleCard, sampleExamples } from "../lessons/sample";
import type { WorkedExamples } from "../placeholders";
import type { UnderTheHoodCard as CardData } from "../types";
import { CardContent, UnderTheHoodCard, uniqueSymbols } from "./index";
import { renderTex } from "./katex-render";
import { sectionHeading, sectionUrl } from "./links";
import { loadKatex, type KatexState } from "./math";
import { keysIn, termsIn } from "./prose";
import { MISSING_TEXT } from "./tex";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const readRepo = (path: string) => readFileSync(`${repoRoot}${path}`, "utf8");

const fixtureExamples = JSON.parse(readRepo("data/fixtures/academy/worked_examples.json")) as WorkedExamples;
const examples: WorkedExamples = { ...fixtureExamples, ...sampleExamples };

/** The key the sample card leaves out on purpose, to show the missing chip. */
const DELIBERATELY_MISSING = "sample.sun_el_deg";

const ready: KatexState = { status: "ready", render: renderTex };

function draw(card: CardData, katex: KatexState, pending = false): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(CardContent, { card, examples, katex, pending })),
  );
}

/** Every string in the card, for checks over all of its text. */
function allText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allText);
  if (value && typeof value === "object") return Object.values(value).flatMap(allText);
  return [];
}

/** The body of one section of docs/science.md, from its heading to the next heading. */
function sectionBody(heading: string): string | null {
  const lines = readRepo("docs/science.md").split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && line.replace(/^#+ /, "") === heading);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{2,3} /.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

const squash = (text: string) => text.replace(/\s+/g, "");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the sample card against the card type", () => {
  it("has all five parts, in full", () => {
    expect(sampleCard.idea.length).toBeGreaterThan(0);
    expect(sampleCard.formulas.length).toBeGreaterThanOrEqual(2);
    expect(sampleCard.workedExample.rows.length).toBeGreaterThan(0);
    expect(sampleCard.inTheCode.length).toBeGreaterThan(0);
    expect(sampleCard.whatCanGoWrong.length).toBeGreaterThan(0);
    for (const formula of sampleCard.formulas) {
      expect(formula.tex).not.toBe("");
      expect(formula.reading).not.toBe("");
      expect(formula.symbols.length).toBeGreaterThan(0);
      for (const symbol of formula.symbols) expect(symbol.unit === null || symbol.unit.length > 0).toBe(true);
    }
  });

  it("exercises every kind of formula: inline, display, a fraction and a square root", () => {
    const displays = new Set(sampleCard.formulas.map((formula) => formula.display));
    expect(displays).toEqual(new Set(["inline", "block"]));
    const block = sampleCard.formulas.filter((formula) => formula.display === "block").map((formula) => formula.tex);
    expect(block.some((tex) => /\\[dt]?frac/.test(tex))).toBe(true);
    expect(block.some((tex) => tex.includes("\\sqrt"))).toBe(true);
  });

  it("quotes each formula word for word from the docs/science.md section it cites", () => {
    for (const formula of sampleCard.formulas) {
      const body = sectionBody(sectionHeading(formula.section));
      expect(body, `section ${formula.section.number} "${formula.section.title}"`).not.toBeNull();
      expect(squash(body ?? ""), formula.id).toContain(squash(formula.tex));
    }
  });

  it("links the section by its GitHub anchor", () => {
    expect(sectionUrl({ number: "4", title: "How high a piece of terrain looks" })).toBe(
      "https://github.com/anahmed404/TrueSouth/blob/main/docs/science.md#4-how-high-a-piece-of-terrain-looks",
    );
    expect(sectionUrl({ number: "3.1", title: "One pull for the whole Moon" })).toMatch(/#31-one-pull-for-the-whole-moon$/);
  });

  it("names a real function in a real file", () => {
    for (const ref of sampleCard.inTheCode) {
      expect(readRepo(ref.file)).toMatch(new RegExp(`def ${ref.fn}\\(`));
    }
  });

  it("uses only explain.ts terms, and only fixture keys apart from the one left out on purpose", () => {
    const text = allText(sampleCard);
    for (const term of text.flatMap(termsIn)) expect(isExplainTerm(term), term).toBe(true);
    const keys = new Set(text.flatMap(keysIn));
    expect(keys.has(DELIBERATELY_MISSING)).toBe(true);
    for (const key of keys) {
      if (key !== DELIBERATELY_MISSING) expect(Object.hasOwn(examples, key), key).toBe(true);
    }
    expect(Object.hasOwn(examples, DELIBERATELY_MISSING)).toBe(false);
  });

  it("lists each shared letter once", () => {
    const texs = uniqueSymbols(sampleCard.formulas).map((symbol) => symbol.tex);
    expect(texs).toEqual([...new Set(texs)]);
    expect(texs).toContain("R");
  });
});

describe("drawing the card", () => {
  it("draws KaTeX with MathML beside it, Fill chips, the missing chip and the citations", () => {
    const html = draw(sampleCard, ready);
    for (const part of ["The idea", "The formulas", "A worked example: one skyline bin", "In the code", "What can go wrong"]) {
      expect(html).toContain(part);
    }
    expect(html).toContain('class="katex"');
    expect(html).toContain("<math");
    expect(html).toContain("katex-display");
    // A number with its unit, as a chip, from text and from inside TeX.
    expect(html).toContain('<span class="ac-fill">3 km</span>');
    expect(html).toContain(`<span class="ac-fill ac-fill--missing">${MISSING_TEXT}</span>`);
    expect(html).toContain("A dashed box is a number that code has not built yet.");
    expect(html).not.toContain("{{");
    expect(html).toContain("Science notes, section 4");
    expect(html).toContain("docs/science.md#4-how-high-a-piece-of-terrain-looks");
    expect(html).toContain("In words: ");
    expect(html).toContain("https://github.com/anahmed404/TrueSouth/blob/main/science/src/truesouth/skyline.py");
    expect(html).toContain('aria-label="About blocker"');
  });

  it("fills placeholders inside TeX as KaTeX Fill chips", () => {
    const calc = sampleCard.workedExample.rows.find((row) => "tex" in row);
    expect(calc).toBeDefined();
    const html = draw(sampleCard, ready);
    // KaTeX writes \htmlClass{ac-fill}{…} as a span with that class, and keeps the number in the MathML.
    expect(html).toContain('class="enclosing ac-fill"');
    expect(html).toContain("<mn>100</mn>");
  });

  it("shows the TeX source, quietly, while KaTeX loads", () => {
    const html = draw(sampleCard, { status: "loading" });
    expect(html).toContain("Loading the maths…");
    expect(html).toContain('data-state="loading"');
    expect(html).toContain("s^2/2R");
    expect(html).not.toContain('class="katex"');
    expect(html).toContain(`<span class="ac-fill ac-fill--missing">${MISSING_TEXT}</span>`);
    expect(html).not.toContain("{{");
  });

  it("shows the same fallback when KaTeX fails to load", () => {
    const html = draw(sampleCard, { status: "failed" });
    expect(html).toContain("The maths could not load");
    expect(html).toContain('class="ac-tex-src ac-tex-src--block" data-state="source"');
  });

  it("says loading, not missing, while worked_examples.json loads", () => {
    const html = draw(sampleCard, ready, true);
    expect(html).not.toContain(MISSING_TEXT);
    expect(html).toContain('data-pending="true"');
  });

  it("shows a formula that fails to parse as its TeX and logs it once, without breaking the card", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken: CardData = {
      ...sampleCard,
      formulas: [{ ...sampleCard.formulas[0], id: "broken", tex: "\\frac{1}{", display: "block" }, ...sampleCard.formulas.slice(1)],
    };
    const html = draw(broken, ready);
    expect(html).toContain('<code class="ac-tex-src ac-tex-src--block" data-state="source">\\frac{1}{</code>');
    expect(html).toContain('class="katex"');
    draw(broken, ready);
    expect(warn.mock.calls.filter(([message]) => String(message).includes("failed to parse"))).toHaveLength(1);
  });

  it("starts ready once KaTeX has loaded", async () => {
    await loadKatex();
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(UnderTheHoodCard, { card: sampleCard, examples, title: "Sample lesson" }),
      ),
    );
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("Loading the maths");
  });

  it("says when a lesson has no card yet", () => {
    const html = renderToStaticMarkup(createElement(UnderTheHoodCard, { card: undefined, examples }));
    expect(html).toContain("This lesson&#x27;s card is not written yet.");
  });
});
