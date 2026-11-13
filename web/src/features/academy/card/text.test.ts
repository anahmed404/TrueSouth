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
    expect(fillTex("{{example.nope}}", {}, true).tex).toContain(PENDING_TEXT);
  });
});
