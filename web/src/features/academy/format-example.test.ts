import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decimalsFor, formatExample, formatNumber, isUsableExample, UNITLESS_KEYS, unitRuleFor } from "./format-example";
import { exampleText, fillPlaceholders, resolveValue } from "./placeholders";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readRepo = (path: string) => readFileSync(`${repoRoot}${path}`, "utf8");

describe("the rounding rule for worked-example numbers", () => {
  it("reads the unit from the key's name", () => {
    expect(unitRuleFor("l1.sun_el_max_deg")?.unit).toBe("deg");
    expect(unitRuleFor("l1.example_subsolar_lat")?.unit).toBe("deg");
    expect(unitRuleFor("l1.example_sun_az")?.unit).toBe("deg");
    expect(unitRuleFor("l4.example_earth_clear")?.unit).toBe("deg");
    expect(unitRuleFor("l2.ridge_dist_km")?.unit).toBe("km");
    expect(unitRuleFor("l3.drop_at_20km_m")?.unit).toBe("m");
    expect(unitRuleFor("l7.slip_blackout_h")?.unit).toBe("h");
    expect(unitRuleFor("l4.earth_up_pct")?.unit).toBe("pct");
    expect(unitRuleFor("l6.example_score")?.unit).toBe("none");
    expect(unitRuleFor("l9.something_new")).toBeNull();
  });

  it("finds a _pct segment, not only a _pct ending", () => {
    for (const key of ["l4.link_pct_mask0", "l4.link_pct_mask1", "l4.link_pct_mask5", "l4.link_pct_by_mask"]) {
      expect(unitRuleFor(key)?.unit, key).toBe("pct");
    }
    expect(formatExample("l4.link_pct_by_mask", [55.694, 15, 6.5])).toBe("56, 15, 7");
    expect(formatExample("l2.site_id", "shackleton_rim")).toBe("shackleton_rim");
    expect(formatExample("l2.site_name", "Shackleton Rim")).toBe("Shackleton Rim");
    expect(formatExample("story.landing_utc", "2028-01-01T00:00:00Z")).toBe("2028-01-01T00:00:00Z");
    expect(unitRuleFor("l4.mask_for_15pct_deg")?.unit).toBe("deg");
    expect(formatExample("l4.link_pct_mask1", 40.4)).toBe("40");
    expect(unitRuleFor("l4.pctile_x")).toBeNull();
  });

  it("shows an angle with at least one decimal and at most two", () => {
    expect(formatExample("l1.sun_el_max_deg", 2.0)).toBe("2.0");
    expect(formatExample("sample.right_angle_deg", 90)).toBe("90.0");
    expect(formatExample("l3.example_el_true_deg", 1.8649)).toBe("1.86");
    expect(formatExample("l1.sun_el_max_deg", 1.5)).toBe("1.5");
    expect(decimalsFor("l1.sun_el_max_deg")).toEqual({ min: 1, max: 2 });
  });

  it("rounds other units, drops their trailing zeros and groups thousands", () => {
    expect(formatExample("l3.drop_at_130km_m", 4864.0)).toBe("4,864");
    expect(formatExample("l3.drop_at_20km_m", 115.1)).toBe("115");
    expect(formatExample("l2.ridge_dist_km", 12.345)).toBe("12.3");
    expect(formatExample("l2.ridge_dist_km", 3.0)).toBe("3");
    expect(formatExample("l6.example_score", 78.8125)).toBe("78.8");
    expect(formatExample("l5.plane_a", 0.0412)).toBe("0.041");
  });

  it("writes a negative with a true minus, and never −0", () => {
    expect(formatExample("l4.earth_el_min_deg", -0.7)).toBe("−0.7");
    expect(formatExample("l4.earth_el_min_deg", -0.001)).toBe("0.0");
    expect(formatNumber(-1234.5, 0)).toBe("−1,235");
  });

  it("writes yes/no, text and lists", () => {
    expect(formatExample("l6.example_metrics.landing_lit", true)).toBe("yes");
    expect(formatExample("l2.ridge_feature", "Synthetic crater rim")).toBe("Synthetic crater rim");
    expect(formatExample("l7.slip_vetoes", ["blackout", "darkness"])).toBe("blackout, darkness");
  });

  it("is the rule lesson text uses too", () => {
    expect(fillPlaceholders("{{example.l3.drop_at_130km_m}} m", { "l3.drop_at_130km_m": 4864 }).text).toBe("4,864 m");
  });

  it("leaves goal values unrounded", () => {
    expect(resolveValue("{{example.l3.drop_at_20km_m}}", { "l3.drop_at_20km_m": 115.1 }).value).toBe(115.1);
  });
});

describe("a value that cannot be written", () => {
  const unusable: [string, unknown][] = [
    ["null", null],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["−Infinity", Number.NEGATIVE_INFINITY],
    ["an object", { value: 1 }],
    ["an empty string", ""],
    ["a blank string", "   "],
    ["an empty list", []],
    ["a list holding null", ["a", null]],
    ["undefined", undefined],
  ];

  for (const [name, value] of unusable) {
    it(`formats ${name} to null and never throws`, () => {
      expect(isUsableExample(value)).toBe(false);
      expect(() => formatExample("l3.example_el_true_deg", value)).not.toThrow();
      expect(formatExample("l3.example_el_true_deg", value)).toBeNull();
      const examples = { "l3.example_el_true_deg": value };
      expect(exampleText(examples, "l3.example_el_true_deg")).toBeNull();
      expect(fillPlaceholders("{{example.l3.example_el_true_deg}}°", examples).missing).toEqual(["l3.example_el_true_deg"]);
      expect(resolveValue("{{example.l3.example_el_true_deg}}", examples).value).toBeNull();
    });
  }
});

/** The keys of the `WorkedExamples` contract type, with their TypeScript types. */
function contractKeys(): [string, string][] {
  const source = readRepo("web/src/contracts/generated.ts");
  const start = source.indexOf("export interface WorkedExamples");
  const body = source.slice(start, source.indexOf("\n}", start));
  return [...body.matchAll(/^\s+"([^"]+)"\??:\s*([^;]+);/gm)].map((match) => [match[1] ?? "", (match[2] ?? "").trim()]);
}

describe("every worked-example key has a unit rule", () => {
  const fixture = JSON.parse(readRepo("data/fixtures/academy/worked_examples.json")) as Record<string, unknown>;
  const contract = contractKeys();

  it("reads the contract type", () => {
    expect(contract.length).toBeGreaterThan(40);
    expect(contract).toContainEqual(["l3.example_el_true_deg", "number"]);
  });

  it("gives every numeric key in the fixture and the contract a unit, or lists it as unitless", () => {
    const numeric = new Set([
      ...Object.entries(fixture).flatMap(([key, value]) =>
        typeof value === "number" || (Array.isArray(value) && value.every((item) => typeof item === "number")) ? [key] : [],
      ),
      ...contract.flatMap(([key, type]) => (type === "number" || type === "number[]" ? [key] : [])),
    ]);
    expect(numeric.size).toBeGreaterThan(40);
    const fallsThrough = [...numeric].filter((key) => unitRuleFor(key) === null);
    expect(fallsThrough).toEqual([]);
  });

  it("lists as unitless only keys that exist and have no unit in their name", () => {
    const known = new Set([...Object.keys(fixture), ...contract.map(([key]) => key)]);
    for (const key of Object.keys(UNITLESS_KEYS)) {
      expect(known.has(key), key).toBe(true);
      expect(/_(deg|lat|lon|az|el|clear|km|m|h)$|_pct(_|$)/.test(key), key).toBe(false);
    }
  });
});
