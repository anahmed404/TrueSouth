import { describe, expect, it } from "vitest";
import { evaluate, evaluationAt, slipSweep, windowLength, type ScoringProfile, type Series } from "./index";

const HOURS = 52_584;
const SITES = 8;
/** Ten times the 200 ms product target, so a busy machine does not flake the suite. */
const GENEROUS_BOUND_MS = 2_000;

describe("slip sweep timing", () => {
  it("evaluates 8 full-grid sites for a 100-day profile inside a generous bound", () => {
    const mission: ScoringProfile = {
      duration_days: 100,
      min_sun_fraction: 0.5,
      ops_sun_el_min_deg: 2,
      max_dark_h: 50,
      relay_available: false,
      antenna_mask_deg: 1,
      max_blackout_h: 12,
      max_slope_deg: 10,
      slope_ideal_deg: 5,
      landing_sun_el_min_deg: null,
      landing_sun_el_max_deg: null,
      weights: { slope: 1, power: 1, comms: 1 },
    };
    expect(windowLength(mission.duration_days)).toBe(2400);

    const sites = Array.from({ length: SITES }, (_, site) => makeSeries(HOURS, 1000 + site));
    const slopes = [3, 8, 12, 9, null, 4, 6, 1];

    // One untimed pass so the measurement is not the cold JIT compile.
    slipSweep(sites[0]!, mission, slopes[0]!);

    const started = performance.now();
    const sweeps = sites.map((series, site) => slipSweep(series, mission, slopes[site]!));
    const elapsed = performance.now() - started;
    console.info(
      `slip sweep: ${SITES} sites × ${HOURS} hours, 100-day window, ${elapsed.toFixed(1)} ms`,
    );

    expect(elapsed).toBeLessThan(GENEROUS_BOUND_MS);
    const landingCount = HOURS - 2400 + 1;
    const checkHours = [0, 1000, 12_345, landingCount - 1];
    for (const sweep of sweeps) {
      expect(sweep.hourCount).toBe(HOURS);
      expect(sweep.landingCount).toBe(landingCount);
      expect(sweep.sunFractionMean).toBeInstanceOf(Float64Array);
    }
    const sample = sites[3]!;
    const sampleSweep = sweeps[3]!;
    for (const hour of checkHours) {
      expect(evaluationAt(sampleSweep, mission, hour)).toEqual(
        evaluate(sample, mission, hour, sampleSweep.slopeDeg),
      );
    }
    expect(evaluationAt(sampleSweep, mission, landingCount)).toBeNull();
    expect(evaluate(sample, mission, landingCount, sampleSweep.slopeDeg)).toBeNull();
  });
});

function makeSeries(count: number, seed: number): Series {
  const random = mulberry32(seed);
  return {
    sun_frac: Float32Array.from({ length: count }, () => random()),
    sun_el: Float32Array.from({ length: count }, () => random() * 20 - 5),
    earth_clear: Float32Array.from({ length: count }, () => random() * 8 - 2),
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
