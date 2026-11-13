import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Sites } from "../../contracts/generated.ts";
import { SERIES_COLUMNS, decodeSeries } from "../../data/decode/index.ts";
import { hourIndexToUtc, utcToHourIndex } from "../time/index.ts";
import {
  cachedCountdowns,
  cachedEvaluation,
  cachedHourFlags,
  cachedSlipSweep,
  clearScoringCache,
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
