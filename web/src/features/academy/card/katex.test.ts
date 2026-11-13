import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_EXPAND, MAX_SIZE_EM, renderTex, trust } from "./katex-render";
import { fillTex } from "./tex";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Renders and returns the HTML, or the error text when KaTeX refused the whole formula. */
function draw(tex: string): string {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = renderTex(tex, true);
  return result.ok ? result.html : `ERROR: ${result.error}`;
}

const EVIL = "https://evil.example/x";

describe("KaTeX trusts only the Fill chip's class", () => {
  const refused: [string, string, RegExp[]][] = [
    ["\\href", String.raw`\href{${EVIL}}{click}`, [/<a[\s>]/, /href=/]],
    ["\\url", String.raw`\url{${EVIL}}`, [/<a[\s>]/, /href=/]],
    ["\\includegraphics", String.raw`\includegraphics[height=1em]{${EVIL}.png}`, [/<img/, /src=/]],
    ["\\htmlClass with another class", String.raw`\htmlClass{evilclass}{x}`, [/class="[^"]*evilclass/]],
    ["\\htmlClass with a chip class and another", String.raw`\htmlClass{ac-fill evilclass}{x}`, [/class="[^"]*evilclass/]],
    ["\\htmlClass with a lookalike class", String.raw`\htmlClass{ac-fillevil}{x}`, [/class="[^"]*ac-fillevil/]],
    ["\\htmlId", String.raw`\htmlId{evilid}{x}`, [/id="evilid"/]],
    ["\\htmlStyle", String.raw`\htmlStyle{background:hotpink}{x}`, [/style="[^"]*hotpink/]],
    ["\\htmlData", String.raw`\htmlData{evil=1}{x}`, [/data-evil=/]],
  ];

  for (const [name, tex, forbidden] of refused) {
    it(`refuses ${name}`, () => {
      const html = draw(tex);
      for (const pattern of forbidden) expect(html, `${name}: ${pattern}`).not.toMatch(pattern);
    });
  }

  it("allows the chip's own classes, and nothing else, in the trust rule", () => {
    expect(trust({ command: "\\htmlClass", class: "ac-fill" })).toBe(true);
    expect(trust({ command: "\\htmlClass", class: "ac-fill ac-fill--missing" })).toBe(true);
    expect(trust({ command: "\\htmlClass", class: "" })).toBe(false);
    expect(trust({ command: "\\htmlClass", class: "ac-fill--missing evil" })).toBe(false);
    expect(trust({ command: "\\href", url: EVIL })).toBe(false);
    expect(trust({ command: "\\htmlId", id: "ac-fill" })).toBe(false);
  });

  it("draws the chip class it does trust", () => {
    expect(draw(String.raw`\htmlClass{ac-fill}{3}`)).toContain('class="enclosing ac-fill"');
  });

  it("escapes a worked-example value that holds HTML and TeX", () => {
    const value = `<img src=x onerror=alert(1)> \\href{${EVIL}}{y} $\\x$ {} & # % _ ^ ~`;
    const filled = fillTex("v = {{example.l2.ridge_feature}}", { "l2.ridge_feature": value });
    const html = draw(filled.tex);
    expect(html).not.toMatch(/^ERROR/);
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/href=/);
    // The words may appear as text; never as an attribute of a tag.
    expect(html).not.toMatch(/<[^>]*\sonerror=/);
    expect(html).toContain("&lt;img");
    expect(html).toContain('class="enclosing ac-fill"');
  });
});

describe("KaTeX's limits", () => {
  it(`caps a size at ${MAX_SIZE_EM} em`, () => {
    // The TeX source is kept in an <annotation>; every drawn size must be capped.
    const html = draw(String.raw`\rule{1000000em}{1em}`).replace(/<annotation[^>]*>.*?<\/annotation>/g, "");
    expect(html).not.toMatch(/1000000em/);
    expect(html).toContain(`border-right-width:${MAX_SIZE_EM}em`);
    expect(html).toContain(`width="${MAX_SIZE_EM}em"`);
    expect(MAX_SIZE_EM).toBe(20);
  });

  it(`stops a formula after ${MAX_EXPAND} macro expansions`, () => {
    expect(MAX_EXPAND).toBe(1000);
    expect(draw(String.raw`\def\a{\a}\a`)).toMatch(/^ERROR: .*expansion/i);
    const many = String.raw`\def\b{x}` + String.raw`\b`.repeat(MAX_EXPAND + 1);
    expect(draw(many)).toMatch(/^ERROR: .*expansion/i);
    expect(draw(String.raw`\def\b{x}\b\b`)).not.toMatch(/^ERROR/);
  });
});
