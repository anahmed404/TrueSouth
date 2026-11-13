/**
 * Memoises the pure scoring functions.
 *
 * The key is the site, the series array the data store is holding, and only
 * the profile fields that computation reads. Dragging the scrubber changes
 * the current hour, which flags and the slip sweep do not read, so those
 * results keep their identity. A worker can later fill a `SlipSweep`; the
 * cached value is already that shape.
 */

import {
  countdowns,
  evaluate,
  hourFlags,
  slipSweep,
  type Countdowns,
  type Evaluation,
  type HourFlags,
  type ScoringProfile,
  type Series,
  type SlipSweep,
} from "./scoring.ts";

/** Fields `hourFlags` and `countdowns` read. Duration and veto limits are not among them. */
const FLAG_FIELDS = [
  "min_sun_fraction",
  "ops_sun_el_min_deg",
  "antenna_mask_deg",
  "relay_available",
] as const satisfies readonly (keyof ScoringProfile)[];

/**
 * Fields `slipSweep` reads. Veto limits and landing-sun limits are applied
 * later, when one landing is rebuilt, so they are not part of this key.
 */
const SWEEP_FIELDS = [
  "duration_days",
  "min_sun_fraction",
  "ops_sun_el_min_deg",
  "antenna_mask_deg",
  "relay_available",
  "max_slope_deg",
  "slope_ideal_deg",
  "weights",
] as const satisfies readonly (keyof ScoringProfile)[];

/** Fields `evaluate` reads. Identity fields such as `name` are not among them. */
const EVAL_FIELDS = [
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
] as const satisfies readonly (keyof ScoringProfile)[];

const flagsCache = new Map<string, HourFlags>();
const evaluationCache = new Map<string, Evaluation | null>();
const countdownCache = new Map<string, Countdowns>();
const sweepCache = new Map<string, SlipSweep>();

const seriesTokens = new WeakMap<object, number>();
let nextSeriesToken = 1;

export function clearScoringCache(): void {
  flagsCache.clear();
  evaluationCache.clear();
  countdownCache.clear();
  sweepCache.clear();
}

/** Slope from a `sites.json` entry. Missing and sphere-tier sites are null. */
export function siteSlopeDeg(
  sites: readonly { id: string; slope: { deg: number } | null }[],
  siteId: string,
): number | null {
  const site = sites.find((item) => item.id === siteId);
  return site?.slope?.deg ?? null;
}

export function cachedHourFlags(siteId: string, series: Series, profile: ScoringProfile): HourFlags {
  const key = cacheKey(siteId, series, picked(profile, FLAG_FIELDS));
  return lookup(flagsCache, key, () => hourFlags(series, profile));
}

export function cachedEvaluation(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  landingHour: number,
  slopeDeg: number | null,
): Evaluation | null {
  const key = cacheKey(siteId, series, [landingHour, slopeDeg, ...picked(profile, EVAL_FIELDS)]);
  return lookup(evaluationCache, key, () => evaluate(series, profile, landingHour, slopeDeg));
}

export function cachedCountdowns(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  currentHour: number,
): Countdowns {
  const key = cacheKey(siteId, series, [currentHour, ...picked(profile, FLAG_FIELDS)]);
  return lookup(countdownCache, key, () => countdowns(series, profile, currentHour));
}

export function cachedSlipSweep(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  slopeDeg: number | null,
): SlipSweep {
  const key = cacheKey(siteId, series, [slopeDeg, ...picked(profile, SWEEP_FIELDS)]);
  return lookup(sweepCache, key, () => slipSweep(series, profile, slopeDeg));
}

function lookup<T>(cache: Map<string, T>, key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  cache.set(key, value);
  return value;
}

function cacheKey(siteId: string, series: Series, parts: unknown[]): string {
  return JSON.stringify([siteId, seriesToken(series), parts]);
}

function seriesToken(series: Series): number {
  const sample = series.sun_frac;
  if (typeof sample !== "object" || sample === null) return 0;
  const existing = seriesTokens.get(sample);
  if (existing !== undefined) return existing;
  const token = nextSeriesToken;
  nextSeriesToken += 1;
  seriesTokens.set(sample, token);
  return token;
}

function picked(
  profile: ScoringProfile,
  fields: readonly (keyof ScoringProfile)[],
): unknown[] {
  return fields.map((field) => {
    if (field === "weights") {
      const weights = profile.weights;
      return [weights.slope, weights.power, weights.comms];
    }
    return profile[field];
  });
}
