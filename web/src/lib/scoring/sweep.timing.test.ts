import { MessageChannel } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { evaluate, evaluationAt, slipSweep, windowLength, type ScoringProfile, type Series } from "./index";
import { handleSweepRequest, type SweepSeries } from "./sweep-protocol";

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

describe("sweep worker timing", () => {
  it("measures one handler sweep and the cost of moving eight series columns", () => {
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
    const columns = Array.from({ length: 8 }, (_, column) => {
      const random = mulberry32(50 + column);
      return Float64Array.from({ length: HOURS }, () => random());
    });
    const series: SweepSeries = {
      sun_frac: columns[0] ?? new Float64Array(),
      sun_el: columns[1] ?? new Float64Array(),
      earth_clear: columns[2] ?? new Float64Array(),
    };
    const grid = { count: HOURS, start_utc: "2026-01-01T00:00:00Z", step_s: 3600 };
    const stored = new Map<number, SweepSeries>();
    const request = {
      type: "sweep" as const,
      requestId: 1,
      siteId: "timing",
      seriesToken: 1,
      series,
      slopeDeg: 4,
      profile: mission,
      timeGrid: grid,
    };
    handleSweepRequest(request, stored);

    const sweepStarted = performance.now();
    const reply = handleSweepRequest({ ...request, requestId: 2, series: undefined }, stored);
    const sweepMs = performance.now() - sweepStarted;
    console.info(`sweep handler: 1 site × ${HOURS} hours, 100-day window, ${sweepMs.toFixed(1)} ms`);

    const cloneStarted = performance.now();
    const cloned = structuredClone(columns);
    const cloneMs = performance.now() - cloneStarted;
    console.info(
      `structured clone: 8 columns × ${HOURS} float64, ${cloneMs.toFixed(1)} ms`,
    );

    const copyStarted = performance.now();
    const copied = columns.map((column) => new Float64Array(column));
    const copyMs = performance.now() - copyStarted;
    const channel = new MessageChannel();
    const transferStarted = performance.now();
    channel.port1.postMessage(
      { columns: copied },
      copied.map((column) => column.buffer),
    );
    const transferMs = performance.now() - transferStarted;
    channel.port1.close();
    channel.port2.close();
    console.info(
      `transfer: 8 columns × ${HOURS} float64, copy ${copyMs.toFixed(1)} ms, postMessage ${transferMs.toFixed(1)} ms`,
    );

    expect(sweepMs).toBeLessThan(GENEROUS_BOUND_MS);
    expect(cloneMs).toBeLessThan(GENEROUS_BOUND_MS);
    expect(copyMs + transferMs).toBeLessThan(GENEROUS_BOUND_MS);
    expect(reply.type).toBe("sweep");
    expect(cloned).toHaveLength(8);
    expect(copied[0]?.byteLength).toBe(0);
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
