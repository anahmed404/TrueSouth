import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { MissionProfile } from "../../contracts/generated";
import type { Evaluation, VetoId } from "../../lib/scoring";
import {
  brokenVetoes,
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
    expect(rule?.provenance).toEqual(profile.provenance.max_blackout_h);
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
