import { describe, expect, it } from "vitest";
import {
  countdowns,
  evaluate,
  evaluationAt,
  evaluationsAtUtcMidnight,
  hourFlags,
  slipSweep,
  utcMidnightHours,
  windowLength,
  type ScoringProfile,
  type Series,
} from "./index";

function profile(changes: Partial<ScoringProfile> = {}): ScoringProfile {
  const base: ScoringProfile = {
    duration_days: 4 / 24,
    min_sun_fraction: 0.5,
    ops_sun_el_min_deg: null,
    max_dark_h: 4,
    relay_available: false,
    antenna_mask_deg: 1,
    max_blackout_h: 4,
    max_slope_deg: 10,
    slope_ideal_deg: 5,
    landing_sun_el_min_deg: null,
    landing_sun_el_max_deg: null,
    weights: { slope: 2, power: 3, comms: 5 },
  };
  return {
    ...base,
    ...changes,
    weights: changes.weights ?? base.weights,
  };
}

function series(sun: ArrayLike<number>, earth?: ArrayLike<number>, el?: ArrayLike<number>): Series {
  const count = sun.length;
  const fill = (values: ArrayLike<number> | undefined, fallback: number) =>
    values ?? Float64Array.from({ length: count }, () => fallback);
  return {
    sun_frac: sun,
    sun_el: fill(el, 2),
    earth_clear: fill(earth, 2),
  };
}

function flagsOf(values: Uint8Array): number[] {
  return Array.from(values);
}

describe("thresholds", () => {
  it("treats a value at the limit as passing and the step below as failing", () => {
    // sun fraction and Earth clearance pass at >= ; elevation too, when it is set.
    const samples = series([0.499, 0.5, 0.501], [0.999, 1, 1.001], [5.999, 6, 6.001]);
    const flags = hourFlags(samples, profile({ ops_sun_el_min_deg: 6 }));
    expect(flagsOf(flags.lit)).toEqual([0, 1, 1]);
    expect(flagsOf(flags.link)).toEqual([0, 1, 1]);
    // A relay is linked at every hour, whatever the clearance is.
    expect(flagsOf(hourFlags(samples, profile({ relay_available: true })).link)).toEqual([1, 1, 1]);
  });

  it("keeps fraction, elevation and clearance as separate conditions", () => {
    // Fraction crosses at hour 1, elevation at hour 2, clearance at hour 3.
    const samples = series([0, 1, 1, 1], [0, 0, 0, 2], [0, 0, 7, 7]);
    const flags = hourFlags(samples, profile({ ops_sun_el_min_deg: 6 }));
    expect(flagsOf(flags.lit)).toEqual([0, 0, 1, 1]);
    expect(flagsOf(flags.link)).toEqual([0, 0, 0, 1]);
  });
});

describe("window length", () => {
  it("rounds a half hour up and keeps a 10-day window at 240 samples", () => {
    // floor(24 × days + 0.5). A 10-day window is 240 hours, not 241.
    expect(windowLength(10)).toBe(240);
    expect(windowLength(6.5)).toBe(156);
    expect(windowLength(2.5 / 24)).toBe(3);
    expect(windowLength(0.5 / 24)).toBe(1);
  });

  it("rejects a window that rounds down to nothing", () => {
    expect(() => windowLength(0.49 / 24)).toThrow(/at least one hour/);
  });

  it("fits the last landing and returns no result for the next hour", () => {
    // 241 samples, window 240. Hour 0 is fully lit. Hour 1 includes the final dark sample.
    // Hour 2 would need sample 241, which does not exist: no result, not a NO-GO.
    const samples = series(Float64Array.from({ length: 241 }, (_, i) => (i < 240 ? 1 : 0)));
    const mission = profile({ duration_days: 10 });
    expect(evaluate(samples, mission, 0, 5)?.metrics.litFraction).toBe(1);
    expect(evaluate(samples, mission, 1, 5)?.metrics.litFraction).toBe(239 / 240);
    expect(evaluate(samples, mission, 2, 5)).toBeNull();
    expect(() => evaluate(samples, mission, 241, 5)).toThrow(RangeError);
  });
});

describe("runs", () => {
  it.each([
    // The fifth sample sits outside the four-hour window.
    { flags: [1, 1, 1, 1], dark: 0, where: "no dark hour" },
    { flags: [0, 0, 1, 1], dark: 2, where: "a run at the start" },
    { flags: [1, 1, 0, 0], dark: 2, where: "a run at the end" },
    { flags: [0, 1, 0, 0], dark: 2, where: "a run in the middle, longer than the one at the start" },
    { flags: [0, 0, 0, 0], dark: 4, where: "the whole window" },
  ])("counts $dark dark hours for $where", ({ flags, dark }) => {
    const samples = series([...flags, 0], [...flags.map((value) => (value ? 2 : 0)), 0]);
    const metrics = evaluate(samples, profile(), 0, 5)?.metrics;
    expect(metrics?.longestDarkH).toBe(dark);
    expect(metrics?.longestBlackoutH).toBe(dark);
  });
});

describe("vetoes and utilities", () => {
  it("stays inside each limit at the boundary and trips just outside it", () => {
    // Two dark hours and two blackout hours. Landing elevation is 4°.
    const samples = series([1, 1, 0, 0], [2, 2, 0, 0], [4, 4, 4, 4]);
    const inside = evaluate(
      samples,
      profile({
        max_dark_h: 2,
        max_blackout_h: 2,
        landing_sun_el_min_deg: 4,
        landing_sun_el_max_deg: 4,
      }),
      0,
      10,
    );
    expect(inside).not.toBeNull();
    expect(Object.values(inside!.vetoes).some((veto) => veto.triggered)).toBe(false);
    // Slope sits on the maximum, so its utility is 0. Power and comms are 0 because
    // g(2, 2) = 0. The limits themselves have not been crossed.
    expect(inside!.utilities).toEqual({ slope: 0, power: 0, comms: 0 });

    const outside = evaluate(
      samples,
      profile({
        max_dark_h: 1,
        max_blackout_h: 1,
        landing_sun_el_min_deg: 5,
        landing_sun_el_max_deg: 3,
      }),
      0,
      11,
    )!;
    expect(outside.vetoes.slope).toMatchObject({ triggered: true, measured: 11, limit: 10 });
    expect(outside.vetoes.darkness).toMatchObject({ triggered: true, measured: 2, limit: 1 });
    expect(outside.vetoes.blackout).toMatchObject({ triggered: true, measured: 2, limit: 1 });
    expect(outside.vetoes.landing_sun_low).toMatchObject({ triggered: true, measured: 4, limit: 5 });
    expect(outside.vetoes.landing_sun_high).toMatchObject({ triggered: true, measured: 4, limit: 3 });
    expect(outside.status).toBe("NO-GO");
  });

  it("trips darkness when the allowance is zero and a dark hour exists", () => {
    // max_dark_h = 0 still vetoes a dark hour. The utility g is 1 when the limit is 0,
    // so the veto, not the utility, carries the limit.
    const result = evaluate(series([0, 1, 1, 1]), profile({ max_dark_h: 0 }), 0, 5)!;
    expect(result.vetoes.darkness.triggered).toBe(true);
    expect(result.metrics.longestDarkH).toBe(1);
  });

  it("does not trip a one-hour darkness or blackout when the limit is one hour", () => {
    const samples = series([1, 0, 1, 1], [2, 0, 2, 2]);
    const result = evaluate(samples, profile({ max_dark_h: 1, max_blackout_h: 1 }), 0, 10)!;
    expect(result.vetoes.darkness.triggered).toBe(false);
    expect(result.vetoes.blackout.triggered).toBe(false);
    expect(evaluate(samples, profile(), 0, 10.001)!.vetoes.slope.triggered).toBe(true);
  });

  it("flags a dark landing", () => {
    const result = evaluate(series([0, 1, 1, 1]), profile(), 0, 5)!;
    expect(result.vetoes.landing_dark).toMatchObject({
      triggered: true,
      measured: false,
      limit: true,
    });
  });

  it("leaves the Sun-elevation vetoes unset when the profile has no such limit", () => {
    const result = evaluate(series([1, 0.5, 0.5, 0], [2, 2, 0, 2], [4, 4, 4, 4]), profile(), 0, 5)!;
    // Mean sun fraction 0.5, one dark hour of a four-hour allowance: 0.5 × (1 − 1/4) = 0.375.
    expect(result.utilities.power).toBe(0.375);
    // Three linked hours and a one-hour blackout: 0.75 × (1 − 1/4) = 0.5625.
    expect(result.utilities.comms).toBe(0.5625);
    expect(result.vetoes.landing_sun_low.triggered).toBe(false);
    expect(result.vetoes.landing_sun_low.limit).toBeNull();
    expect(result.vetoes.landing_sun_high.limit).toBeNull();
  });
});

describe("score", () => {
  const fullSun = () => series([1, 1, 1, 1], [0, 0, 0, 0]);

  it("normalises weights that do not sum to 1, including a relay and a zero weight", () => {
    // Slope utility (10 − 7.5) / (10 − 5) = 0.5. Relay comms is 1. Power is 1.
    // (3×1 + 5×1 + 2×0.5) / 10 = 0.9, so the score is 90.
    const mission = profile({
      relay_available: true,
      weights: { slope: 2, power: 3, comms: 5 },
    });
    const result = evaluate(fullSun(), mission, 0, 7.5)!;
    expect(result.utilities.slope).toBe(0.5);
    expect(result.utilities.comms).toBe(1);
    expect(result.score).toBe(90);
    expect(result.status).toBe("GO");
    expect(result.vetoes.blackout.triggered).toBe(false);
    expect(evaluate(fullSun(), mission, 0, 5)!.utilities.slope).toBe(1);

    const noSlope = evaluate(fullSun(), mission, 0, null)!;
    expect(noSlope.utilities.slope).toBeNull();
    expect(noSlope.slopeNotAssessed).toBe(true);
    // Slope drops out of both sums: (3×1 + 5×1) / 8 = 1.
    expect(noSlope.score).toBe(100);

    // Power 7, comms 3, slope weight 0 and no slope. Earth is below the mask, so
    // link fraction is 0 and comms utility is 0. 7/10 = 0.7, score 70, which is GO.
    const onThreshold = evaluate(
      fullSun(),
      profile({
        relay_available: false,
        weights: { slope: 0, power: 7, comms: 3 },
      }),
      0,
      null,
    )!;
    expect(onThreshold.score).toBe(70);
    expect(onThreshold.status).toBe("GO");

    const below = evaluate(
      fullSun(),
      profile({
        relay_available: false,
        weights: { slope: 0, power: 6, comms: 4 },
      }),
      0,
      null,
    )!;
    expect(below.score).toBe(60);
    expect(below.status).toBe("CAUTION");
  });

  it("keeps a veto as NO-GO even when the score is 100", () => {
    // Relay and full sun score 100, but 11° is over the 10° slope limit.
    const result = evaluate(
      series([1, 1, 1, 1]),
      profile({ relay_available: true, weights: { slope: 0, power: 1, comms: 1 } }),
      0,
      11,
    )!;
    expect(result.score).toBe(100);
    expect(result.vetoes.slope.triggered).toBe(true);
    expect(result.status).toBe("NO-GO");
  });

  it("rejects a slope ideal that is not below the maximum, even with no slope", () => {
    expect(() => evaluate(series([1, 1, 1, 1]), profile({ slope_ideal_deg: 10 }), 0, null)).toThrow(
      /slope_ideal_deg/,
    );
    expect(() => evaluate(series([1, 1, 1, 1]), profile({ slope_ideal_deg: 11 }), 0, null)).toThrow(
      /slope_ideal_deg/,
    );
  });

  it("rejects assessed weights that sum to zero", () => {
    expect(() =>
      evaluate(series([1, 1, 1, 1]), profile({ weights: { slope: 4, power: 0, comms: 0 } }), 0, null),
    ).toThrow(/assessed weights/);
    expect(() =>
      evaluate(series([1, 1, 1, 1]), profile({ weights: { slope: 0, power: 0, comms: 0 } }), 0, 3),
    ).toThrow(/assessed weights/);
  });

  it("gives a relay no blackout and full comms utility", () => {
    const result = evaluate(
      series([1, 0, 1, 1], [2, 0, 2, 2]),
      profile({ relay_available: true, max_blackout_h: 0 }),
      0,
      5,
    )!;
    expect(result.metrics.longestBlackoutH).toBe(0);
    expect(result.utilities.comms).toBe(1);
    expect(result.vetoes.blackout.triggered).toBe(false);
  });

  it("is NO-GO for an unlit landing even when power utility is zero", () => {
    const result = evaluate(series([0, 0, 0, 0]), profile(), 0, null)!;
    expect(result.utilities.power).toBe(0);
    expect(result.status).toBe("NO-GO");
    expect(result.slopeNotAssessed).toBe(true);
  });
});

describe("countdowns", () => {
  it("interpolates sunset and sunrise halfway between hourly samples", () => {
    // Fraction 0.5 and clearance 1 are crossed halfway between hours 1 and 2.
    const samples = series([1, 0.75, 0.25, 0, 1], [2, 1.5, 0.5, 0, 2]);
    expect(countdowns(samples, profile(), 0)).toMatchObject({ sunset: 1.5, earthset: 1.5 });
    expect(countdowns(samples, profile(), 3)).toMatchObject({ sunrise: 0.5, earthrise: 0.5 });
    expect(countdowns(samples, profile(), 4)).toMatchObject({ sunset: null, earthset: null });
  });

  it("uses the elevation limit, the earliest sunset and the latest sunrise", () => {
    const mission = profile({ ops_sun_el_min_deg: 6 });
    // The disc stays full. Elevation crosses 6 halfway from 8° to 4°.
    expect(countdowns(series([1, 1], [2, 2], [8, 4]), mission, 0).sunset).toBe(0.5);
    // Disc rises through 0.5 at 1/4 h. Elevation reaches 6° at 3/4 h. Sunrise waits for both.
    expect(countdowns(series([0.25, 1.25], [2, 2], [3, 7]), mission, 0).sunrise).toBe(0.75);
    // Disc fails at 1/4 h. Elevation fails at 3/4 h. Sunset is the earlier failure.
    expect(countdowns(series([0.75, -0.25], [2, 2], [9, 5]), mission, 0).sunset).toBe(0.25);
  });

  it("counts a crossing that happens at the current hour as zero", () => {
    // Both values are exactly on their thresholds and then fall, so the crossing fraction is 0.
    const result = countdowns(series([0.5, 0], [1, 0]), profile(), 0);
    expect(result.sunset).toBe(0);
    expect(result.earthset).toBe(0);
  });

  it("has no Earth event when a relay keeps the link up", () => {
    // Clearance crosses the mask, but the relay flag never changes.
    const result = countdowns(series([1, 1, 1], [2, 0, 2]), profile({ relay_available: true }), 0);
    expect(result.earthset).toBeNull();
    expect(result.earthrise).toBeNull();
  });

  it("rejects a current hour outside the grid", () => {
    expect(() => countdowns(series([1, 1]), profile(), -1)).toThrow(RangeError);
    expect(() => countdowns(series([1, 1]), profile(), 2)).toThrow(RangeError);
  });
});

describe("slip sweep", () => {
  it("matches a single evaluation at every landing of a seeded series", () => {
    const random = mulberry32(17);
    const count = 50;
    const samples = series(
      Float64Array.from({ length: count }, () => random()),
      Float64Array.from({ length: count }, () => random() * 2),
      Float64Array.from({ length: count }, () => random() * 10),
    );
    const mission = profile();
    const sweep = slipSweep(samples, mission, 6);
    expect(sweep.hourCount).toBe(count);
    expect(sweep.landingCount).toBe(count - sweep.windowHours + 1);
    for (let hour = 0; hour < count; hour++) {
      expect(evaluationAt(sweep, mission, hour)).toEqual(evaluate(samples, mission, hour, 6));
    }
  });

  it("matches on runs placed at the start, middle and end", () => {
    const samples = series([1, 1, 0, 0, 1, 0, 0, 0, 1], [2, 0, 0, 2, 2, 2, 0, 0, 2]);
    const mission = profile();
    const sweep = slipSweep(samples, mission, null);
    for (let hour = 0; hour < samples.sun_frac.length; hour++) {
      expect(evaluationAt(sweep, mission, hour)).toEqual(evaluate(samples, mission, hour, null));
    }
  });

  it("reads only the 00:00 UTC landings", () => {
    // Index 0 is 00:00 UTC on the time grid, so midnight is every 24th hour.
    const sun = Array.from({ length: 48 }, (_, hour) => (hour % 5 === 0 ? 0 : 1));
    const samples = series(sun);
    const mission = profile({ duration_days: 10 / 24 });
    const sweep = slipSweep(samples, mission, 4);
    expect(Array.from(utcMidnightHours(48))).toEqual([0, 24]);
    const rows = evaluationsAtUtcMidnight(sweep, mission);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(evaluate(samples, mission, 0, 4));
    expect(rows[1]).toEqual(evaluate(samples, mission, 24, 4));

    const short = series(Array.from({ length: 30 }, () => 1));
    const shortSweep = slipSweep(short, mission, 4);
    const shortRows = evaluationsAtUtcMidnight(shortSweep, mission);
    expect(shortRows[0]).toEqual(evaluate(short, mission, 0, 4));
    expect(shortRows[1]).toBeNull();
    expect(evaluate(short, mission, 24, 4)).toBeNull();
  });

  it("returns no result for every hour when the window is longer than the series", () => {
    const samples = series([1, 1, 1]);
    const sweep = slipSweep(samples, profile({ duration_days: 10 }), 1);
    expect(sweep.landingCount).toBe(0);
    expect(evaluationAt(sweep, profile({ duration_days: 10 }), 0)).toBeNull();
    expect(evaluationAt(sweep, profile({ duration_days: 10 }), 2)).toBeNull();
  });
});

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

describe("stable scoring boundaries", () => {
  it.each([0.7, 7000 * 0.0001])("gives every identical one-hour A1 window 70 and GO (%s)", (fraction) => {
    const samples = series(Array(16).fill(fraction), Array(16).fill(1), Array(16).fill(1));
    const mission = profile({ duration_days: 1 / 24, weights: { slope: 0, power: 1, comms: 0 } });
    const sweep = slipSweep(samples, mission, null);
    const first = evaluate(samples, mission, 0, null);
    for (let hour = 0; hour < 16; hour++) {
      const result = evaluate(samples, mission, hour, null);
      expect(result?.score).toBe(70);
      expect(result?.status).toBe("GO");
      expect(result).toStrictEqual(first);
      expect(evaluationAt(sweep, mission, hour)).toStrictEqual(first);
    }
  });

  it.each([7, 83, 2026])("preserves identical window bits after long prefixes (seed %s)", (seed) => {
    const random = mulberry32(seed);
    const n = 37;
    const window = series(
      Array.from({ length: n }, () => Math.floor(random() * 10001) * 0.0001),
      Array.from({ length: n }, () => (Math.floor(random() * 401) - 100) * 0.01),
      Array.from({ length: n }, () => (Math.floor(random() * 701) - 200) * 0.01),
    );
    const mission = profile({ duration_days: n / 24, max_dark_h: 17, max_blackout_h: 11,
      ops_sun_el_min_deg: 1, weights: { slope: 3, power: 7, comms: 2 } });
    const expected = evaluate(window, mission, 0, 6);
    const bits = (value: unknown) => new Uint8Array(new Float64Array([Number(value)]).buffer);
    for (const offset of [0, 1, 15, 1024, 50000]) {
      const shifted: Series = {
        sun_frac: [...Array(offset).fill(1), ...Array.from(window.sun_frac)],
        sun_el: [...Array(offset).fill(90), ...Array.from(window.sun_el)],
        earth_clear: [...Array(offset).fill(90), ...Array.from(window.earth_clear)],
      };
      const result = evaluate(shifted, mission, offset, 6);
      expect(result).toStrictEqual(expected);
      expect(bits(result?.metrics.sunFractionMean)).toEqual(bits(expected?.metrics.sunFractionMean));
      expect(bits(result?.score)).toEqual(bits(expected?.score));
      expect(evaluationAt(slipSweep(shifted, mission, 6), mission, offset)).toStrictEqual(expected);
    }
  });

  it("does not let residue flip a veto or utility breakpoint", () => {
    const samples = series([0.7, 0], [1, 0], [2, 2]);
    const mission = profile({ duration_days: 2 / 24, max_dark_h: 1 - 2e-13, max_blackout_h: 1 - 2e-13,
      landing_sun_el_min_deg: 2 + 2e-13, landing_sun_el_max_deg: 2 - 2e-13 });
    const result = evaluate(samples, mission, 0, 10 + 2e-13)!;
    expect(Object.values(result.vetoes).some((veto) => veto.triggered)).toBe(false);
    expect(result.utilities).toEqual({ slope: 0, power: 0, comms: 0 });
    expect(evaluate(samples, mission, 0, 10 + 2e-11)?.vetoes.slope.triggered).toBe(true);
    expect(evaluate(series([1, 1]), profile({ duration_days: 2 / 24 }), 0, 5 + 2e-13)?.utilities.slope).toBe(1);
    expect(evaluate(series([0.7]), profile({ duration_days: 1 / 24, max_dark_h: 2e-13 }), 0, 5)?.utilities.power).toBe(0.7);
    const flags = hourFlags(series([0.5], [1], [2]), profile({ min_sun_fraction: 0.5 + 2e-13,
      ops_sun_el_min_deg: 2 + 2e-13, antenna_mask_deg: 1 + 2e-13 }));
    expect(Array.from(flags.lit)).toEqual([1]);
    expect(Array.from(flags.link)).toEqual([1]);
    expect(countdowns(series([0.5, 0], [1, 0]), profile({ min_sun_fraction: 0.5 + 2e-13 }), 0).sunset).toBe(0);
  });

  it("returns exactly 70 through all three weights", () => {
    const mission = profile({ duration_days: 1 / 24, relay_available: true, slope_ideal_deg: 0,
      weights: { slope: 1, power: 1, comms: 1 } });
    const result = evaluate(series([0.6]), mission, 0, 5)!;
    expect(result.utilities).toEqual({ slope: 0.5, power: 0.6, comms: 1 });
    expect(result.score).toBe(70);
    expect(result.status).toBe("GO");
  });
});
