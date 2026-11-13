import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSites, parseValidation } from "./parse.ts";

const fixtures = JSON.parse(
  readFileSync(new URL("../../../data/fixtures/sites.json", import.meta.url), "utf8"),
) as Record<string, unknown>[];

function oldSite(): Record<string, unknown> {
  const site = { ...fixtures[0] };
  delete site.variant_of;
  delete site.offset_m;
  delete site.nearby_sun;
  return site;
}

function validation(gate: Record<string, unknown>) {
  return {
    generated_utc: "2026-11-13T00:00:00Z",
    gates: [gate],
    comparisons: [],
  };
}

describe("validation gates", () => {
  const measured = {
    id: "G2",
    name: "Directions match",
    passed: true,
    measured: 0.01,
    limit: 0.02,
    unit: "deg",
    samples: 4,
    detail: null,
  };

  it("accepts a measured gate and a gate this command did not measure", () => {
    expect(parseValidation(validation(measured)).gates[0]?.passed).toBe(true);
    const unchecked = parseValidation(validation({
      ...measured,
      id: "G10",
      passed: null,
      measured: null,
      samples: 0,
      detail: "It is checked by the web tests.",
    }));
    expect(unchecked.gates[0]?.passed).toBeNull();
    expect(unchecked.gates[0]?.measured).toBeNull();
  });

  it.each([
    { passed: "true", measured: null },
    { passed: null, measured: "0" },
    { passed: 1, measured: 0 },
    { passed: null, measured: 0 },
    { passed: false, measured: null },
  ])("rejects a wrong passed or measured type %j", (fields) => {
    expect(() => parseValidation(validation({ ...measured, ...fields }))).toThrow(/validation\.json/);
  });
});

describe("sites placement fields", () => {
  it("accepts old fixture sites and explicit null defaults", () => {
    expect(parseSites([oldSite()])).toHaveLength(1);
    expect(parseSites([{ ...oldSite(), variant_of: null, offset_m: null, nearby_sun: null }]))
      .toHaveLength(1);
  });

  it("accepts placement fields and preserves their values", () => {
    const record = { ...oldSite(), id: "ridge_best_lit", variant_of: "ridge", offset_m: 80,
      nearby_sun: { radius_m: 160, points: 13, min: .2, max: .9 } };
    expect(parseSites([record])[0]).toEqual(record);
  });

  it.each([
    { variant_of: 12 }, { variant_of: "bad id", offset_m: 1 },
    { offset_m: "80" }, { nearby_sun: [] }, { nearby_sun: "sunny" },
    { variant_of: "ridge" }, { offset_m: 10 },
    { id: "ridge_best_lit", variant_of: "ridge", offset_m: -1 },
    { id: "wrong", variant_of: "ridge", offset_m: 1 },
    ...[
      { radius_m: "160" }, { radius_m: 0 }, { radius_m: Infinity },
      { points: "13" }, { points: 0 }, { points: 1.5 }, { points: true },
      { min: "0.2" }, { min: -.1 }, { max: 1.1 }, { max: NaN },
      { min: .9, max: .8 }, { extra: true },
    ].map((change) => ({ nearby_sun: { radius_m: 160, points: 13, min: .2, max: .9, ...change } })),
  ])("rejects invalid placement fields %j", (fields) => {
    expect(() => parseSites([{ ...oldSite(), ...fields }])).toThrow(/sites\.json/);
  });
});
