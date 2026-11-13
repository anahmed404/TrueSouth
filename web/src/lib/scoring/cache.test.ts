import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Sites } from "../../contracts/generated.ts";
import { SERIES_COLUMNS, decodeSeries } from "../../data/decode/index.ts";
import { hourIndexToUtc, utcToHourIndex } from "../time/index.ts";
import {
  SCORING_CACHE_LIMITS,
  cachedCountdowns,
  cachedEvaluation,
  cachedHourFlags,
  cachedSlipSweep,
  clearScoringCache,
  peekSlipSweep,
  rememberSlipSweep,
  scoringCacheSizes,
  siteSlopeDeg,
} from "./cache.ts";
import { countdowns, evaluate, hourFlags, slipSweep, type ScoringProfile, type Series } from "./scoring.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixtureRoot = path.join(repoRoot, "data", "fixtures");

beforeEach(() => {
  clearScoringCache();
});

function profile(changes: Partial<ScoringProfile> = {}): ScoringProfile {
  const base: ScoringProfile = {
    duration_days: 2 / 24,
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
    weights: { slope: 1, power: 1, comms: 1 },
  };
  return { ...base, ...changes, weights: changes.weights ?? base.weights };
}

function series(): Series {
  return {
    sun_frac: Float64Array.of(1, 0, 1, 1),
    sun_el: Float64Array.of(2, 2, 2, 2),
    earth_clear: Float64Array.of(2, 0, 2, 2),
  };
}

describe("scoring cache", () => {
  it("returns the same object when the inputs it reads are unchanged", () => {
    const samples = series();
    const limits = profile();
    const flags = cachedHourFlags("site", samples, limits);
    const evaluation = cachedEvaluation("site", samples, limits, 0, 3);
    const sweep = cachedSlipSweep("site", samples, limits, 3);
    const cards = cachedCountdowns("site", samples, limits, 0);

    expect(cachedHourFlags("site", samples, limits)).toBe(flags);
    expect(cachedEvaluation("site", samples, limits, 0, 3)).toBe(evaluation);
    expect(cachedSlipSweep("site", samples, limits, 3)).toBe(sweep);
    expect(cachedCountdowns("site", samples, limits, 0)).toBe(cards);
    expect(cachedHourFlags("other", samples, limits)).not.toBe(flags);
  });

  it("keeps flags and the sweep when a field they do not read changes", () => {
    const samples = series();
    const limits = profile();
    const flags = cachedHourFlags("site", samples, limits);
    const sweep = cachedSlipSweep("site", samples, limits, 3);
    const unread = profile({ max_dark_h: 99, max_blackout_h: 99, landing_sun_el_min_deg: 1 });

    expect(cachedHourFlags("site", samples, unread)).toBe(flags);
    expect(cachedSlipSweep("site", samples, unread, 3)).toBe(sweep);
    expect(cachedHourFlags("site", samples, profile({ min_sun_fraction: 0.9 }))).not.toBe(flags);
    expect(cachedSlipSweep("site", samples, profile({ duration_days: 3 / 24 }), 3)).not.toBe(sweep);
    expect(cachedSlipSweep("site", samples, limits, 4)).not.toBe(sweep);
  });

  it("keeps an evaluation when only its name changes, and drops it when a limit changes", () => {
    const samples = series();
    const limits = profile();
    const evaluation = cachedEvaluation("site", samples, limits, 0, 3);
    const renamed = Object.assign(profile(), { name: "Other" });

    expect(cachedEvaluation("site", samples, renamed, 0, 3)).toBe(evaluation);
    expect(cachedEvaluation("site", samples, profile({ max_dark_h: 1 }), 0, 3)).not.toBe(evaluation);
    expect(cachedEvaluation("site", samples, limits, 1, 3)).not.toBe(evaluation);
  });

  it("recomputes countdowns for a new hour without touching flags or the sweep", () => {
    const samples = series();
    const limits = profile();
    const flags = cachedHourFlags("site", samples, limits);
    const sweep = cachedSlipSweep("site", samples, limits, 3);
    const atStart = cachedCountdowns("site", samples, limits, 0);

    expect(cachedCountdowns("site", samples, profile({ max_dark_h: 99 }), 0)).toBe(atStart);
    expect(cachedCountdowns("site", samples, limits, 2)).not.toBe(atStart);
    expect(cachedHourFlags("site", samples, limits)).toBe(flags);
    expect(cachedSlipSweep("site", samples, limits, 3)).toBe(sweep);
  });

  it("drops the least recently used entry at the cap and recomputes it", () => {
    const samples = series();
    const limits = profile();
    const cases = [
      {
        label: "flags",
        limit: SCORING_CACHE_LIMITS.flags,
        size: () => scoringCacheSizes().flags,
        read: (id: string) => cachedHourFlags(id, samples, limits),
        pure: () => hourFlags(samples, limits),
      },
      {
        label: "sweeps",
        limit: SCORING_CACHE_LIMITS.sweeps,
        size: () => scoringCacheSizes().sweeps,
        read: (id: string) => cachedSlipSweep(id, samples, limits, 3),
        pure: () => slipSweep(samples, limits, 3),
      },
      {
        label: "evaluations",
        limit: SCORING_CACHE_LIMITS.evaluations,
        size: () => scoringCacheSizes().evaluations,
        read: (id: string) => cachedEvaluation(id, samples, limits, 0, 3),
        pure: () => evaluate(samples, limits, 0, 3),
      },
      {
        label: "countdowns",
        limit: SCORING_CACHE_LIMITS.countdowns,
        size: () => scoringCacheSizes().countdowns,
        read: (id: string) => cachedCountdowns(id, samples, limits, 0),
        pure: () => countdowns(samples, limits, 0),
      },
    ];

    for (const item of cases) {
      clearScoringCache();
      const first = item.read("id-0");
      const second = item.read("id-1");
      for (let index = 2; index <= item.limit; index += 1) item.read(`id-${index}`);
      expect(item.size(), item.label).toBe(item.limit);
      expect(item.read("id-1"), item.label).toBe(second);
      const recomputed = item.read("id-0");
      expect(recomputed, item.label).not.toBe(first);
      expect(recomputed, item.label).toEqual(item.pure());
      expect(item.size(), item.label).toBe(item.limit);
    }
  });

  it("does not return the previous result when a field that scoring reads changes", () => {
    const samples = series();
    const base = profile();
    const readers = [
      {
        label: "hourFlags",
        fields: ["min_sun_fraction", "ops_sun_el_min_deg", "antenna_mask_deg", "relay_available"],
        run: (next: ScoringProfile) => cachedHourFlags("site", samples, next),
      },
      {
        label: "countdowns",
        fields: ["min_sun_fraction", "ops_sun_el_min_deg", "antenna_mask_deg", "relay_available"],
        run: (next: ScoringProfile) => cachedCountdowns("site", samples, next, 0),
      },
      {
        label: "slipSweep",
        fields: [
          "duration_days",
          "min_sun_fraction",
          "ops_sun_el_min_deg",
          "antenna_mask_deg",
          "relay_available",
          "max_slope_deg",
          "slope_ideal_deg",
          "weights",
        ],
        run: (next: ScoringProfile) => cachedSlipSweep("site", samples, next, 3),
      },
      {
        label: "evaluate",
        fields: [
          "duration_days",
          "min_sun_fraction",
          "ops_sun_el_min_deg",
          "max_dark_h",
          "relay_available",
          "antenna_mask_deg",
          "max_blackout_h",
          "max_slope_deg",
          "slope_ideal_deg",
          "landing_sun_el_min_deg",
          "landing_sun_el_max_deg",
          "weights",
        ],
        run: (next: ScoringProfile) => cachedEvaluation("site", samples, next, 0, 3),
      },
    ];

    for (const reader of readers) {
      clearScoringCache();
      const previous = reader.run(base);
      for (const field of reader.fields) {
        const next = reader.run(changedProfile(field));
        expect(next, `${reader.label} ${field}`).not.toBe(previous);
      }
    }
  });
});

function changedProfile(field: string): ScoringProfile {
  switch (field) {
    case "duration_days":
      return profile({ duration_days: 3 / 24 });
    case "min_sun_fraction":
      return profile({ min_sun_fraction: 0.25 });
    case "ops_sun_el_min_deg":
      return profile({ ops_sun_el_min_deg: 6 });
    case "antenna_mask_deg":
      return profile({ antenna_mask_deg: 4 });
    case "relay_available":
      return profile({ relay_available: true });
    case "max_slope_deg":
      return profile({ max_slope_deg: 12 });
    case "slope_ideal_deg":
      return profile({ slope_ideal_deg: 2 });
    case "weights":
      return profile({ weights: { slope: 1, power: 2, comms: 1 } });
    case "max_dark_h":
      return profile({ max_dark_h: 1 });
    case "max_blackout_h":
      return profile({ max_blackout_h: 1 });
    case "landing_sun_el_min_deg":
      return profile({ landing_sun_el_min_deg: 0 });
    case "landing_sun_el_max_deg":
      return profile({ landing_sun_el_max_deg: 3 });
    default:
      throw new Error(`no change for ${field}`);
  }
}

describe("worker sweep cache", () => {
  it("stores a computed sweep under the sweep key and drops the least recently used", () => {
    const samples = series();
    const limits = profile();
    const sweep = slipSweep(samples, limits, 3);
    rememberSlipSweep("site", samples, limits, 3, sweep);

    expect(peekSlipSweep("site", samples, limits, 3)).toBe(sweep);
    expect(cachedSlipSweep("site", samples, limits, 3)).toBe(sweep);

    for (let index = 0; index < SCORING_CACHE_LIMITS.sweeps; index += 1) {
      rememberSlipSweep(`pad-${index}`, samples, limits, 3, sweep);
    }
    expect(scoringCacheSizes().sweeps).toBe(SCORING_CACHE_LIMITS.sweeps);
    expect(peekSlipSweep("site", samples, limits, 3)).toBeUndefined();
    expect(peekSlipSweep("pad-1", samples, limits, 3)).toBe(sweep);
  });

  it("does not return a sweep stored for a different time grid count", () => {
    const samples = series();
    const limits = profile();
    const sweep = slipSweep(samples, limits, 3);
    const grid = { start_utc: "2026-01-01T00:00:00Z", step_s: 3600, count: samples.sun_frac.length };
    rememberSlipSweep("site", samples, limits, 3, sweep, grid);
    expect(peekSlipSweep("site", samples, limits, 3, { ...grid, count: grid.count + 1 })).toBeUndefined();
    expect(peekSlipSweep("site", samples, limits, 3, grid)).toBe(sweep);
  });
});

describe("fixture scoring through the cache", () => {
  const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8")) as Manifest;
  const sites = JSON.parse(readFileSync(path.join(fixtureRoot, "sites.json"), "utf8")) as Sites;
  const profiles = JSON.parse(readFileSync(path.join(fixtureRoot, "profiles.json"), "utf8")) as MissionProfile[];
  const im2 = profiles.find((item) => item.id === "im2_athena");
  if (!im2) throw new Error("fixtures are missing im2_athena");

  it("matches the pure functions for fixture_ridge and im2_athena", () => {
    const slope = siteSlopeDeg(sites, "fixture_ridge");
    expect(slope).toBe(3);
    const decoded = loadSeries("sites/fixture_ridge/series.bin", manifest.time_grid.count);
    const landingHour = utcToHourIndex(manifest.time_grid, "2028-03-01T00:00:00Z");
    const currentHour = landingHour + 36;

    expect(cachedHourFlags("fixture_ridge", decoded, im2)).toEqual(hourFlags(decoded, im2));
    expect(cachedEvaluation("fixture_ridge", decoded, im2, landingHour, slope)).toEqual(
      evaluate(decoded, im2, landingHour, slope),
    );
    expect(cachedCountdowns("fixture_ridge", decoded, im2, currentHour)).toEqual(
      countdowns(decoded, im2, currentHour),
    );
    expect(cachedSlipSweep("fixture_ridge", decoded, im2, slope)).toEqual(slipSweep(decoded, im2, slope));
    expect(hourIndexToUtc(manifest.time_grid, landingHour)).toBe("2028-03-01T00:00:00Z");
  });

  it("passes a null slope for the sphere-tier fixture", () => {
    expect(siteSlopeDeg(sites, "fixture_sphere")).toBeNull();
    const decoded = loadSeries("sites/fixture_sphere/series.bin", manifest.time_grid.count);
    const landingHour = utcToHourIndex(manifest.time_grid, "2028-03-01T00:00:00Z");
    const result = cachedEvaluation("fixture_sphere", decoded, im2, landingHour, null);

    expect(result).toEqual(evaluate(decoded, im2, landingHour, null));
    expect(result?.slopeNotAssessed).toBe(true);
  });
});

function loadSeries(relativePath: string, count: number): Series {
  const bytes = readFileSync(path.join(fixtureRoot, relativePath));
  const width = SERIES_COLUMNS.length;
  expect(bytes.byteLength).toBe(width * count * 2);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, count, "series.bin");
}
