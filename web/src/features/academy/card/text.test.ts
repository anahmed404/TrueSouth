import { describe, expect, it } from "vitest";
import { keysIn, parseProse, termsIn } from "./prose";
import { fillTex, MISSING_TEXT, PENDING_TEXT } from "./tex";

describe("card text", () => {
  it("splits maths, placeholders with their units, terms and code", () => {
    expect(
      parseProse("The [[skyline_bin|bin]] at {{example.a_deg}}° is $s^2/2R$, {{example.b_m}} m away, in `elevation_angle`."),
    ).toEqual([
      { kind: "text", text: "The " },
      { kind: "term", term: "skyline_bin", label: "bin" },
      { kind: "text", text: " at " },
      { kind: "fill", key: "a_deg", unit: "°" },
      { kind: "text", text: " is " },
      { kind: "math", tex: "s^2/2R" },
      { kind: "text", text: ", " },
      { kind: "fill", key: "b_m", unit: " m" },
      { kind: "text", text: " away, in " },
      { kind: "code", text: "elevation_angle" },
      { kind: "text", text: "." },
    ]);
  });

  it("labels a bare term by its key and keeps an escaped dollar as text", () => {
    expect(parseProse("[[skyline_bin]] costs \\$5")).toEqual([
      { kind: "term", term: "skyline_bin", label: "skyline bin" },
      { kind: "text", text: " costs $5" },
    ]);
  });

  it("does not take a word that only starts like a unit", () => {
    expect(parseProse("{{example.x}} more")).toEqual([
      { kind: "fill", key: "x", unit: "" },
      { kind: "text", text: " more" },
    ]);
  });

  it("finds the keys and terms text names, inside maths too", () => {
    expect(keysIn("$a = {{example.x}}$ and {{example.y.z}}")).toEqual(["x", "y.z"]);
    expect(termsIn("[[blocker]] and [[skyline_bin|bin]]")).toEqual(["blocker", "skyline_bin"]);
  });
});

describe("placeholders inside TeX", () => {
  const examples = { "l3.drop_at_130km_m": 4864, "l4.earth_el_min_deg": -0.7, "l2.ridge_feature": "Rim #2" };

  it("fills a number as a Fill chip, with TeX's own minus and comma", () => {
    expect(fillTex("d = {{example.l3.drop_at_130km_m}}\\,\\text{m}", examples)).toEqual({
      tex: "d = \\htmlClass{ac-fill}{4{,}864}\\,\\text{m}",
      missing: [],
    });
    expect(fillTex("e = {{example.l4.earth_el_min_deg}}", examples).tex).toBe("e = \\htmlClass{ac-fill}{-0.7}");
  });

  it("sets text as escaped \\text", () => {
    expect(fillTex("{{example.l2.ridge_feature}}", examples).tex).toBe("\\htmlClass{ac-fill}{\\text{Rim \\#2}}");
  });

  it("turns a missing key into a 'value not built yet' chip, never the raw token", () => {
    const filled = fillTex("x = {{example.nope}}", examples);
    expect(filled.missing).toEqual(["nope"]);
    expect(filled.tex).toBe(`x = \\htmlClass{ac-fill ac-fill--missing}{\\text{${MISSING_TEXT}}}`);
    expect(filled.tex).not.toContain("{{");
  });

  it("says loading, not missing, while the examples load", () => {
    expect(fillTex("{{example.nope}}", {}, { pending: true }).tex).toContain(PENDING_TEXT);
  });

  it("turns an unusable value (null, NaN, Infinity, an object, empty text) into the missing chip", () => {
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY, { a: 1 }, "", []]) {
      const filled = fillTex("x = {{example.v_deg}}", { v_deg: value });
      expect(filled.missing).toEqual(["v_deg"]);
      expect(filled.tex).toContain(MISSING_TEXT);
    }
  });

  it("turns a malformed key into the missing chip, and leaves other braces alone", () => {
    const filled = fillTex(String.raw`a = {{example.l.bad-key}} + {{example.}} + \frac{{a}}{2}`, { "l.bad-key": 1 });
    expect(filled.missing).toEqual(["l.bad-key", ""]);
    expect(filled.tex).not.toContain("{{example");
    expect(filled.tex).toContain(String.raw`\frac{{a}}{2}`);
  });

  it("uses a compared set's decimals", () => {
    const precision = new Map([["l3.example_el_true_deg", { min: 1, max: 3 }]]);
    expect(fillTex("{{example.l3.example_el_true_deg}}", { "l3.example_el_true_deg": 1.8612 }, { precision }).tex).toBe(
      String.raw`\htmlClass{ac-fill}{1.861}`,
    );
  });
});

describe("malformed placeholders and comparisons in card text", () => {
  it("makes anything shaped like {{example.…}} a placeholder, so it never leaks", () => {
    expect(parseProse("A {{example.l.bad-key}}° B")).toEqual([
      { kind: "text", text: "A " },
      { kind: "fill", key: "l.bad-key", unit: "°" },
      { kind: "text", text: " B" },
    ]);
  });

  it("leaves a literal {{ that is not that shape as text", () => {
    expect(parseProse("Write {{x}} or {{ example.a }} or {{example.a}")).toEqual([
      { kind: "text", text: "Write {{x}} or {{ example.a }} or {{example.a}" },
    ]);
  });

  it("reads a comparison's two keys and three words", () => {
    expect(parseProse("looks {{compare:a_deg, b_deg|lower than|higher than|as high as}} on")).toEqual([
      { kind: "text", text: "looks " },
      { kind: "compare", keys: ["a_deg", "b_deg"], words: ["lower than", "higher than", "as high as"] },
      { kind: "text", text: " on" },
    ]);
    expect(keysIn("{{compare:a_deg,b_deg|x|y|z}} {{example.c}}")).toEqual(["a_deg", "b_deg", "c"]);
  });
});
