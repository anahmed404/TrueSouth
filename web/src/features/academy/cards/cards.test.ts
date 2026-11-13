import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { isExplainTerm } from "../../../lib/explain";
import { CardContent } from "../card";
import { renderTex } from "../card/katex-render";
import { sectionHeading } from "../card/links";
import type { KatexState } from "../card/math";
import { keysIn, termsIn } from "../card/prose";
import { MISSING_TEXT } from "../card/tex";
import { WRITTEN_LESSONS } from "../lessons";
import type { WorkedExamples } from "../placeholders";
import type { UnderTheHoodCard } from "../types";
import { WORKED_EXAMPLE_KEYS } from "../worked-example-keys";
import { CARDS, LESSON_CARDS } from "./index";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const readRepo = (path: string) => readFileSync(`${repoRoot}${path}`, "utf8");
const real = JSON.parse(readRepo("data/derived/academy/worked_examples.json")) as WorkedExamples;
const ready: KatexState = { status: "ready", render: renderTex };
const squash = (text: string) => text.replace(/\s+/g, "");

function sectionBody(heading: string): string | null {
  const lines = readRepo("docs/science.md").split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && line.replace(/^#+ /, "") === heading);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{2,3} /.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

function allText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allText);
  if (value && typeof value === "object") return Object.values(value).flatMap(allText);
  return [];
}

function draw(card: UnderTheHoodCard, examples: WorkedExamples): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(CardContent, { card, examples, katex: ready, pending: false, source: "derived" })),
  );
}

const cases = LESSON_CARDS.map((card) => [card.id, card] as const);

describe("the cards of lessons 1 to 4", () => {
  it("are the cards the four written lessons name", () => {
    for (const lesson of WRITTEN_LESSONS) expect(CARDS[lesson.card], lesson.id).toBeDefined();
    expect(LESSON_CARDS.map((card) => card.id)).toEqual(WRITTEN_LESSONS.map((lesson) => lesson.card));
  });

  it.each(cases)("%s quotes each formula word for word from the docs/science.md section it cites", (_, card) => {
    for (const formula of card.formulas) {
      const body = sectionBody(sectionHeading(formula.section));
      expect(body, `${card.id} ${formula.id}: section ${formula.section.number} "${formula.section.title}"`).not.toBeNull();
      expect(squash(body ?? ""), `${card.id} ${formula.id}`).toContain(squash(formula.tex));
      expect(formula.reading.length).toBeGreaterThan(0);
      expect(formula.symbols.length).toBeGreaterThan(0);
    }
  });

  it.each(cases)("%s names real functions in real files", (_, card) => {
    for (const ref of card.inTheCode) {
      const source = readRepo(ref.file);
      const pattern = ref.file.endsWith(".py") ? new RegExp(`def ${ref.fn}\\(`) : new RegExp(`export function ${ref.fn}\\(`);
      expect(source, `${ref.file}::${ref.fn}`).toMatch(pattern);
    }
  });

  it.each(cases)("%s uses only explain.ts terms and contract keys, all present in the real data", (_, card) => {
    const text = allText(card);
    for (const term of text.flatMap(termsIn)) expect(isExplainTerm(term), term).toBe(true);
    const keys = text.flatMap(keysIn);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(WORKED_EXAMPLE_KEYS, key).toContain(key);
      expect(Object.hasOwn(real, key), key).toBe(true);
    }
  });

  it.each(cases)("%s types no number about the Moon in its worked example: every number is a placeholder", (_, card) => {
    for (const row of card.workedExample.rows) {
      if ("value" in row) expect(row.value.replace(/\{\{[^}]*\}\}/g, ""), row.label).not.toMatch(/\d/);
    }
  });

  it.each(cases)("%s draws on the real data with no raw placeholder and no missing chip", (_, card) => {
    const html = draw(card, real);
    for (const part of ["The idea", "The formula", "A worked example", "In the code", "What can go wrong"]) expect(html).toContain(part);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("{{");
    expect(html).not.toContain(MISSING_TEXT);
    expect(html).toContain("Science notes, section");
  });

  it("lesson 3's card says the most distant blocker's height above Pip is negative, and why", () => {
    const l3 = CARDS.l3_horizon;
    expect(l3).toBeDefined();
    const outro = l3?.workedExample.outro ?? "";
    expect(outro).toMatch(/negative/);
    expect(outro).toMatch(/below Pip's eyes/);
    const html = draw(l3 as UnderTheHoodCard, real);
    expect(html).toMatch(/<span class="ac-fill">−1,578[\s ]m<\/span>/);
    expect(html).toContain("lower than on a flat Moon");
  });

  it("lesson 2's card picks its comparison word from the data", () => {
    const html = draw(CARDS.l2_skyline as UnderTheHoodCard, real);
    expect(html).toContain("The Sun’s centre is below the skyline".replace("’", "&#x27;"));
  });
});

describe("the cards of lessons 1 to 4 against docs/academy/lessons.md", () => {
  const doc = readRepo("docs/academy/lessons.md");

  /** The "Card:" paragraph of a lesson, up to the next blank line. */
  function cardParagraph(number: number): string {
    const start = doc.indexOf(`## ${number}. `);
    const card = doc.indexOf("**Card:**", start);
    return doc.slice(card, doc.indexOf("\n\n", card));
  }

  it.each(LESSON_CARDS.map((card, index) => [index + 1, card] as const))("lesson %s's card quotes only sections its Card paragraph lists", (number, card) => {
    const paragraph = cardParagraph(number);
    for (const formula of card.formulas) {
      expect(paragraph, `${card.id} quotes §${formula.section.number}`).toContain(`§${formula.section.number}`);
    }
  });

  it.each(cases)("%s: every learner-visible string is pinned, so a change is a deliberate update", (_, card) => {
    expect(allText(card)).toMatchSnapshot();
  });
});
