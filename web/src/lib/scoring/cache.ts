/**
 * Memoises the pure scoring functions.
 *
 * The key is the site, the series array the data store is holding, and only
 * the profile fields that computation reads. Dragging the scrubber changes
 * the current hour, which flags and the slip sweep do not read, so those
 * results keep their identity. The sweep worker fills the same `SlipSweep`
 * shape through `rememberSlipSweep`; a later read uses the same key.
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

/**
 * Hour flags are two byte arrays over the full grid (about 100 KB at 52,584
 * hours) and a sweep is about 2 MB, so those caches stop at 24 entries:
 * 8 selected sites times a few profiles. An evaluation and a countdown are
 * one small object, so they stop at 512 (8 sites times 64 landings) and
 * 2048 (8 sites times 256 scrubbed hours). Each cache drops the least
 * recently used entry past that maximum.
 */
const FLAG_CACHE_LIMIT = 24;
const SWEEP_CACHE_LIMIT = 24;
const EVALUATION_CACHE_LIMIT = 512;
const COUNTDOWN_CACHE_LIMIT = 2048;

export const SCORING_CACHE_LIMITS = {
  flags: FLAG_CACHE_LIMIT,
  sweeps: SWEEP_CACHE_LIMIT,
  evaluations: EVALUATION_CACHE_LIMIT,
  countdowns: COUNTDOWN_CACHE_LIMIT,
} as const;

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

export function scoringCacheSizes(): {
  flags: number;
  sweeps: number;
  evaluations: number;
  countdowns: number;
} {
  return {
    flags: flagsCache.size,
    sweeps: sweepCache.size,
    evaluations: evaluationCache.size,
    countdowns: countdownCache.size,
  };
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
  return lookup(flagsCache, FLAG_CACHE_LIMIT, key, () => hourFlags(series, profile));
}

export function cachedEvaluation(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  landingHour: number,
  slopeDeg: number | null,
): Evaluation | null {
  const key = cacheKey(siteId, series, [landingHour, slopeDeg, ...picked(profile, EVAL_FIELDS)]);
  return lookup(evaluationCache, EVALUATION_CACHE_LIMIT, key, () =>
    evaluate(series, profile, landingHour, slopeDeg),
  );
}

export function cachedCountdowns(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  currentHour: number,
): Countdowns {
  const key = cacheKey(siteId, series, [currentHour, ...picked(profile, FLAG_FIELDS)]);
  return lookup(countdownCache, COUNTDOWN_CACHE_LIMIT, key, () => countdowns(series, profile, currentHour));
}

/** Same key `cachedSlipSweep` uses. A hit and a worker store must agree. */
export function slipSweepCacheKey(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  slopeDeg: number | null,
): string {
  return cacheKey(siteId, series, [slopeDeg, ...picked(profile, SWEEP_FIELDS)]);
}

/** The cached sweep, or undefined. A hit becomes the most recently used. */
export function peekSlipSweep(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  slopeDeg: number | null,
): SlipSweep | undefined {
  const key = slipSweepCacheKey(siteId, series, profile, slopeDeg);
  if (!sweepCache.has(key)) return undefined;
  const hit = sweepCache.get(key) as SlipSweep;
  sweepCache.delete(key);
  sweepCache.set(key, hit);
  return hit;
}

/** Store a sweep the worker (or a test) already computed. Same cap as the lookup. */
export function rememberSlipSweep(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  slopeDeg: number | null,
  sweep: SlipSweep,
): void {
  const key = slipSweepCacheKey(siteId, series, profile, slopeDeg);
  sweepCache.delete(key);
  sweepCache.set(key, sweep);
  if (sweepCache.size > SWEEP_CACHE_LIMIT) {
    const oldest = sweepCache.keys().next().value;
    if (oldest !== undefined) sweepCache.delete(oldest);
  }
}

export function cachedSlipSweep(
  siteId: string,
  series: Series,
  profile: ScoringProfile,
  slopeDeg: number | null,
): SlipSweep {
  const key = slipSweepCacheKey(siteId, series, profile, slopeDeg);
  return lookup(sweepCache, SWEEP_CACHE_LIMIT, key, () => slipSweep(series, profile, slopeDeg));
}

function lookup<T>(cache: Map<string, T>, limit: number, key: string, compute: () => T): T {
  if (cache.has(key)) {
    const hit = cache.get(key) as T;
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = compute();
  cache.set(key, value);
  if (cache.size > limit) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
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
