import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { MissionProfile } from "../../contracts/generated";
import type { Evaluation, VetoId } from "../../lib/scoring";
import {
  VETO_META,
  brokenVetoes,
  distinctDecimals,
  railFact as railFactOf,
  ruleFields,
  scoreText,
  scoreTitle,
  settingsProvenance,
  severity,
  utilityFields,
  valueAndLimit,
  describeEvaluation,
  describeMetrics,
  describeUtilities,
  formatLimit,
  formatValue,
  moreBroken,
  railFact,
  statusSentence,
  worstBrokenVeto,
} from "./rules";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const profiles = JSON.parse(
  readFileSync(path.join(repoRoot, "data", "fixtures", "profiles.json"), "utf8"),
) as MissionProfile[];

function preset(id: string): MissionProfile {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`fixtures are missing ${id}`);
  return structuredClone(found);
}

/** An evaluation built by hand: only the display logic is under test here. */
function evaluation(overrides: Partial<Record<VetoId, Partial<Evaluation["vetoes"][VetoId]>>> = {}, rest: Partial<Evaluation> = {}): Evaluation {
  const base: Evaluation = {
    metrics: {
      sunFractionMean: 0.9,
      litFraction: 0.95,
      longestDarkH: 4,
      linkFraction: 0.871,
      longestBlackoutH: 10,
      landingSunElDeg: 0.8,
      landingLit: true,
    },
    vetoes: {
      slope: { triggered: false, measured: 3.1, limit: 10 },
      darkness: { triggered: false, measured: 4, limit: 6 },
      blackout: { triggered: false, measured: 10, limit: 12 },
      landing_dark: { triggered: false, measured: true, limit: true },
      landing_sun_low: { triggered: false, measured: 0.8, limit: null },
      landing_sun_high: { triggered: false, measured: 0.8, limit: null },
    },
    utilities: { slope: 0.98, power: 0.3, comms: 0.1 },
    score: 81.4,
    status: "GO",
    slopeNotAssessed: false,
  };
  for (const [id, veto] of Object.entries(overrides)) {
    base.vetoes[id as VetoId] = { ...base.vetoes[id as VetoId], ...veto };
  }
  return { ...base, ...rest };
}

describe("formatting", () => {
  it("puts a narrow no-break space before a unit and none before degrees", () => {
    expect(formatValue(31, "h")).toBe("31 h");
    expect(formatValue(3.14, "°", 1)).toBe("3.1°");
    expect(formatValue(-0.5, "°", 2)).toBe("−0.50°");
    expect(formatValue(0.96, "", 2)).toBe("0.96");
  });

  it("writes a limit without trailing zeros", () => {
    expect(formatLimit(10, "°")).toBe("10°");
    expect(formatLimit(6.5, "d")).toBe("6.5 d");
    expect(formatLimit(0.25, "")).toBe("0.25");
  });
});

describe("the worst broken rule", () => {
  it("is null when every rule passes", () => {
    expect(worstBrokenVeto(evaluation())).toBeNull();
    expect(railFact(evaluation())).toBe("Score 81");
  });

  it("is the one furthest past its limit, as a share of the limit", () => {
    const e = evaluation(
      {
        blackout: { triggered: true, measured: 31, limit: 12 }, // 1.58 over
        slope: { triggered: true, measured: 12, limit: 10 }, // 0.2 over
      },
      { status: "NO-GO" },
    );
    expect(brokenVetoes(e)).toEqual(["blackout", "slope"]);
    expect(railFact(e)).toBe("Blackout: 31 h, limit 12 h");
    expect(moreBroken(e)).toBe("1 more rule broken");
  });

  it("puts a dark landing first, whatever else is broken", () => {
    const e = evaluation(
      {
        blackout: { triggered: true, measured: 400, limit: 12 },
        landing_dark: { triggered: true, measured: false },
      },
      { status: "NO-GO" },
    );
    expect(worstBrokenVeto(e)).toBe("landing_dark");
    expect(railFact(e)).toBe("Dark at landing");
  });

  it("ranks by the true share of a limit under 1: 0.75 against 0.5 outranks 1.4 against 1", () => {
    const e = evaluation(
      {
        slope: { triggered: true, measured: 1.4, limit: 1 }, // 40 % over
        darkness: { triggered: true, measured: 0.75, limit: 0.5 }, // 50 % over
      },
      { status: "NO-GO" },
    );
    expect(severity(e, "darkness")).toBeCloseTo(0.5);
    expect(severity(e, "slope")).toBeCloseTo(0.4);
    expect(brokenVetoes(e)).toEqual(["darkness", "slope"]);
  });

  it("uses the absolute excess only when the limit is exactly 0", () => {
    const e = evaluation(
      {
        darkness: { triggered: true, measured: 5, limit: 0 }, // 5 over, no share
        blackout: { triggered: true, measured: 40, limit: 12 }, // 2.33 of the limit
      },
      { status: "NO-GO" },
    );
    expect(severity(e, "darkness")).toBe(5);
    expect(brokenVetoes(e)).toEqual(["darkness", "blackout"]);
  });

  it("does not divide by a zero limit", () => {
    const e = evaluation({ darkness: { triggered: true, measured: 5, limit: 0 } }, { status: "NO-GO" });
    expect(worstBrokenVeto(e)).toBe("darkness");
    expect(railFact(e)).toBe("Dark: 5 h, limit 0 h");
  });

  it("measures a low landing Sun below its minimum", () => {
    const e = evaluation(
      {
        landing_sun_low: { triggered: true, measured: 0.8, limit: 6 },
        slope: { triggered: true, measured: 10.5, limit: 10 },
      },
      { status: "NO-GO" },
    );
    expect(worstBrokenVeto(e)).toBe("landing_sun_low");
    expect(railFact(e)).toBe("Sun at landing: 0.80°, at least 6°");
  });

  it("keeps the listed order when two rules are equally bad", () => {
    const e = evaluation(
      {
        darkness: { triggered: true, measured: 12, limit: 6 },
        blackout: { triggered: true, measured: 24, limit: 12 },
      },
      { status: "NO-GO" },
    );
    expect(brokenVetoes(e)).toEqual(["darkness", "blackout"]);
  });
});

describe("the focused-site panel's rules", () => {
  it("lists a broken rule with its value, its limit and the limit's provenance", () => {
    const profile = preset("im2_athena");
    const e = evaluation({ blackout: { triggered: true, measured: 31, limit: 12 } }, { status: "NO-GO" });
    const view = describeEvaluation(e, profile);
    expect(view.broken).toHaveLength(1);
    const rule = view.broken[0];
    expect(rule?.value).toBe(31);
    expect(rule?.limit).toBe(12);
    expect(rule?.limitText).toBe("limit 12 h");
    expect(rule?.provenance.parts.map((part) => part.field)).toEqual(["max_blackout_h", "relay_available", "antenna_mask_deg"]);
    expect(rule?.provenance.parts[0]?.provenance).toEqual(profile.provenance.max_blackout_h);
    expect(rule?.sentence).toMatch(/31 h in a row/);
    expect(view.statusSentence).toBe("One rule is broken, so this landing date fails.");
  });

  it("leaves out rules that were not checked: no slope, no landing-light limits", () => {
    const profile = preset("im2_athena");
    const e = evaluation({ slope: { measured: null } }, { slopeNotAssessed: true });
    const ids = describeEvaluation(e, profile).passing.map((r) => r.id);
    expect(ids).toEqual(["landing_dark", "darkness", "blackout"]);
  });

  it("shows a relay instead of a blackout rule", () => {
    const profile = { ...preset("im2_athena"), relay_available: true };
    const ids = describeEvaluation(evaluation(), profile).passing.map((r) => r.id);
    expect(ids).not.toContain("blackout");
    expect(ids).toContain("relay");
  });

  it("says what each status means", () => {
    expect(statusSentence(evaluation(), 0)).toMatch(/score is 70 or more/);
    expect(statusSentence(evaluation({}, { status: "CAUTION" }), 0)).toMatch(/under 70/);
    expect(statusSentence(evaluation({}, { status: "NO-GO" }), 3)).toBe("Three rules are broken, so this landing date fails.");
  });

  it("gives each weight its share of the assessed weights, leaving slope out when it was not assessed", () => {
    const profile = preset("im2_athena");
    const shares = describeUtilities(evaluation(), profile).map((u) => u.share);
    expect(shares[0]).toBeCloseTo(0.4);
    expect(shares[1]).toBeCloseTo(0.35);
    const noSlope = describeUtilities(evaluation({}, { utilities: { slope: null, power: 0.3, comms: 0.1 } }), profile);
    expect(noSlope[0]?.share).toBeNull();
    expect(noSlope[1]?.share).toBeCloseTo(0.35 / 0.6);
  });

  it("lists every metric as a percentage or with its unit, and marks the broken ones", () => {
    const metrics = describeMetrics(evaluation({ blackout: { triggered: true } }));
    expect(metrics.map((m) => m.term)).toEqual([
      "sun_fraction_mean",
      "lit_fraction",
      "longest_dark_h",
      "link_fraction",
      "longest_blackout_h",
      "landing_sun_el_deg",
      "landing_lit",
    ]);
    expect(metrics.find((m) => m.term === "link_fraction")?.value).toBeCloseTo(87.1);
    expect(metrics.filter((m) => m.broken).map((m) => m.term)).toEqual(["longest_blackout_h"]);
  });
});

describe("rounding never contradicts the verdict", () => {
  it("adds decimals until a value and its limit print differently", () => {
    expect(distinctDecimals(10.01, 10, 1)).toBe(2);
    expect(valueAndLimit(10.01, 10, "°", 1)).toEqual({ value: "10.01°", limit: "10°", decimals: 2 });
    expect(valueAndLimit(9.999, 10, "°", 1)).toEqual({ value: "9.999°", limit: "10°", decimals: 3 });
    expect(valueAndLimit(12.4, 12, "h", 0)).toEqual({ value: "12.4\u202fh", limit: "12\u202fh", decimals: 1 });
    expect(valueAndLimit(12.5, 12, "h", 0)).toEqual({ value: "13\u202fh", limit: "12\u202fh", decimals: 0 });
    expect(valueAndLimit(10.00001, 10, "°", 1).decimals).toBe(4);
  });

  it("prints truly equal numbers the same", () => {
    expect(valueAndLimit(10, 10, "°", 1)).toEqual({ value: "10.0°", limit: "10.0°", decimals: 1 });
    expect(valueAndLimit(6, 6, "h", 0)).toEqual({ value: "6\u202fh", limit: "6\u202fh", decimals: 0 });
  });

  it("keeps the rule's own precision when the numbers already differ", () => {
    expect(valueAndLimit(12, 10, "°", 1)).toEqual({ value: "12.0°", limit: "10°", decimals: 1 });
  });

  it("applies to every veto, in the panel and in the rail", () => {
    const profile = preset("im2_athena");
    const slope = evaluation({ slope: { triggered: true, measured: 10.01, limit: 10 } }, { status: "NO-GO" });
    expect(describeEvaluation(slope, profile).broken[0]?.valueLabel).toBe("10.01°");
    expect(railFactOf(slope)).toBe("Slope: 10.01°, limit 10°");

    const passing = evaluation({ slope: { measured: 9.999, limit: 10 } });
    const row = describeEvaluation(passing, profile).passing.find((r) => r.id === "slope");
    expect(row?.valueLabel).toBe("9.999°");
    expect(row?.limitText).toBe("limit 10°");

    const sunLow = evaluation({ landing_sun_low: { triggered: true, measured: 5.999, limit: 6 } }, { status: "NO-GO" });
    expect(railFactOf(sunLow)).toBe("Sun at landing: 5.999°, at least 6°");

    const dark = evaluation({ darkness: { triggered: true, measured: 6.4, limit: 6 } }, { status: "NO-GO" });
    expect(railFactOf(dark)).toBe("Dark: 6.4\u202fh, limit 6\u202fh");
  });

  it("rounds the score down, so it never prints across the GO threshold", () => {
    expect(scoreText(69.6)).toBe("69");
    expect(scoreText(69.999)).toBe("69");
    expect(scoreText(70.0)).toBe("70");
    expect(scoreText(100)).toBe("100");
    expect(scoreTitle(69.999)).toBe("Score 69.999 of 100, shown rounded down");
    expect(scoreTitle(69.99999)).toMatch(/^Score 69\.999 /);
    expect(railFactOf(evaluation({}, { score: 69.6, status: "CAUTION" }))).toBe("Score 69");
  });
});

describe("sourced only if every setting that feeds a row is sourced", () => {
  function withKinds(kinds: Partial<Record<string, "sourced" | "assumed">>): MissionProfile {
    const profile = preset("im2_athena");
    const record = profile.provenance as unknown as Record<string, unknown>;
    for (const [field, kind] of Object.entries(kinds)) {
      record[field] =
        kind === "sourced"
          ? { kind: "sourced", source_url: `https://example.org/${field}`, quote: `quote for ${field}` }
          : { kind: "assumed", reason: `reason for ${field}` };
    }
    return profile;
  }

  it("is sourced when one sourced setting feeds the row", () => {
    const profile = withKinds({ max_slope_deg: "sourced" });
    expect(settingsProvenance(profile, ["max_slope_deg"]).kind).toBe("sourced");
  });

  it("makes a dark landing assumed when the operations Sun limit is assumed, and names both", () => {
    const profile = { ...withKinds({ min_sun_fraction: "sourced", ops_sun_el_min_deg: "assumed" }), ops_sun_el_min_deg: 6 };
    const tag = settingsProvenance(profile, ruleFields(profile, "landing_dark"));
    expect(tag.kind).toBe("assumed");
    expect(tag.parts.map((part) => part.label)).toEqual(["Sun disc needed to be lit", "Lowest Sun to operate"]);
    const row = describeEvaluation(evaluation({ landing_dark: { triggered: true, measured: false } }, { status: "NO-GO" }), profile)
      .broken[0];
    expect(row?.provenance.kind).toBe("assumed");
  });

  it("keeps a dark landing sourced only when both lit settings are sourced", () => {
    const both = { ...withKinds({ min_sun_fraction: "sourced", ops_sun_el_min_deg: "sourced" }), ops_sun_el_min_deg: 6 };
    expect(settingsProvenance(both, ruleFields(both, "landing_dark")).kind).toBe("sourced");
    const noOps = withKinds({ min_sun_fraction: "sourced", ops_sun_el_min_deg: "assumed" });
    expect(ruleFields(noOps, "landing_dark")).toEqual(["min_sun_fraction"]);
    expect(settingsProvenance(noOps, ruleFields(noOps, "landing_dark")).kind).toBe("sourced");
  });

  it("checks every setting behind the darkness and blackout rows", () => {
    const profile = { ...preset("im2_athena"), ops_sun_el_min_deg: 6 };
    expect(ruleFields(profile, "darkness")).toEqual(["max_dark_h", "min_sun_fraction", "ops_sun_el_min_deg"]);
    expect(ruleFields(profile, "blackout")).toEqual(["max_blackout_h", "relay_available", "antenna_mask_deg"]);
    expect(ruleFields(profile, "landing_sun_low")).toEqual(["landing_sun_el_min_deg"]);
    expect(ruleFields(profile, "landing_sun_high")).toEqual(["landing_sun_el_max_deg"]);
    const viper = withKinds({ max_blackout_h: "sourced", relay_available: "sourced", antenna_mask_deg: "assumed" });
    expect(settingsProvenance(viper, ruleFields(viper, "blackout")).kind).toBe("assumed");
  });

  it("checks every setting behind each utility, weights included", () => {
    const profile = preset("im2_athena");
    expect(utilityFields(profile, "slope")).toEqual(["max_slope_deg", "slope_ideal_deg", "weights"]);
    expect(utilityFields(profile, "power")).toEqual(["min_sun_fraction", "max_dark_h", "weights"]);
    expect(utilityFields(profile, "comms")).toEqual(["relay_available", "antenna_mask_deg", "max_blackout_h", "weights"]);
    expect(utilityFields({ ...profile, relay_available: true }, "comms")).toEqual(["relay_available", "weights"]);
    const all = withKinds({ max_slope_deg: "sourced", slope_ideal_deg: "sourced", weights: "assumed" });
    expect(describeUtilities(evaluation(), all)[0]?.provenance.kind).toBe("assumed");
    const sourced = withKinds({ max_slope_deg: "sourced", slope_ideal_deg: "sourced", weights: "sourced" });
    expect(describeUtilities(evaluation(), sourced)[0]?.provenance.kind).toBe("sourced");
  });
});

describe("every row's label and unit", () => {
  // A wrong unit or label fails here by name.
  const VETO_ROWS: [VetoId, string, string, string][] = [
    // id, name when broken, name when it passes, unit
    ["landing_dark", "Dark at landing", "Lit at landing", ""],
    ["slope", "Slope", "Slope", "°"],
    ["darkness", "Longest dark stretch", "Dark stretch", "h"],
    ["blackout", "Longest blackout", "Blackout", "h"],
    ["landing_sun_low", "Sun at landing", "Sun at landing", "°"],
    ["landing_sun_high", "Sun at landing", "Sun at landing", "°"],
  ];
  for (const [id, name, passName, unit] of VETO_ROWS) {
    it(`veto ${id}: "${name}" / "${passName}" in ${unit === "" ? "no unit" : unit}`, () => {
      expect(VETO_META[id].name).toBe(name);
      expect(VETO_META[id].passName).toBe(passName);
      expect(VETO_META[id].unit).toBe(unit);
    });
  }

  const METRIC_ROWS: [string, string, string][] = [
    ["sun_fraction_mean", "Mean Sun disc fraction", ""],
    ["lit_fraction", "Lit", "%"],
    ["longest_dark_h", "Longest dark stretch", "h"],
    ["link_fraction", "Earth link", "%"],
    ["longest_blackout_h", "Longest blackout", "h"],
    ["landing_sun_el_deg", "Sun at landing", "°"],
    ["landing_lit", "Lit at landing", ""],
  ];
  const metrics = describeMetrics(evaluation());
  it("lists exactly these mission-window metrics, in this order", () => {
    expect(metrics.map((m) => m.term)).toEqual(METRIC_ROWS.map(([term]) => term));
  });
  for (const [term, name, unit] of METRIC_ROWS) {
    it(`metric ${term}: "${name}" in ${unit === "" ? "no unit" : unit}`, () => {
      const row = metrics.find((m) => m.term === term);
      expect(row?.name).toBe(name);
      expect(row?.unit).toBe(unit);
    });
  }
});
