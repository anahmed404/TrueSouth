/**
 * Port of `science/src/truesouth/scoring.py`.
 *
 * Gate G10 (docs/validation.md) is the proof this matches the reference.
 * Any change to the rules must be made in docs/science.md first, then in
 * the Python reference, then here.
 *
 * No terrain or ephemeris. Inputs are decoded section 7 columns. The
 * functions are pure and use only values a Web Worker can structured-clone.
 */

import type { MissionProfile } from "../../contracts/generated";

/** Columns this module reads. Names match the series contract. */
export type Series = {
  sun_frac: ArrayLike<number>;
  sun_el: ArrayLike<number>;
  earth_clear: ArrayLike<number>;
};

/** Profile fields the score uses. A full `MissionProfile` satisfies this. */
export type ScoringProfile = Pick<
  MissionProfile,
  | "duration_days"
  | "min_sun_fraction"
  | "ops_sun_el_min_deg"
  | "max_dark_h"
  | "relay_available"
  | "antenna_mask_deg"
  | "max_blackout_h"
  | "max_slope_deg"
  | "slope_ideal_deg"
  | "landing_sun_el_min_deg"
  | "landing_sun_el_max_deg"
  | "weights"
>;

export type HourFlags = {
  lit: Uint8Array;
  link: Uint8Array;
};

export type Metrics = {
  sunFractionMean: number;
  litFraction: number;
  longestDarkH: number;
  linkFraction: number;
  longestBlackoutH: number;
  landingSunElDeg: number;
  landingLit: boolean;
};

/** Veto ids are the words in docs/science.md §10. */
export type VetoId =
  | "slope"
  | "darkness"
  | "blackout"
  | "landing_dark"
  | "landing_sun_low"
  | "landing_sun_high";

export type Veto = {
  triggered: boolean;
  measured: number | boolean | null;
  limit: number | boolean | null;
};

export type Vetoes = Record<VetoId, Veto>;

export type Utilities = {
  slope: number | null;
  power: number;
  comms: number;
};

export type Status = "GO" | "CAUTION" | "NO-GO";

export type Evaluation = {
  metrics: Metrics;
  vetoes: Vetoes;
  utilities: Utilities;
  score: number;
  status: Status;
  slopeNotAssessed: boolean;
};

export type Countdowns = {
  sunset: number | null;
  sunrise: number | null;
  earthset: number | null;
  earthrise: number | null;
};

/**
 * Compact result of evaluating every landing hour.
 * Index `i >= landingCount` has no result (the window runs off the grid).
 * Metrics use exact integer counts in float64. Pass the same profile back to
 * `evaluationAt` to rebuild one landing.
 */
export type SlipSweep = {
  hourCount: number;
  windowHours: number;
  landingCount: number;
  slopeDeg: number | null;
  sunFractionMean: Float64Array;
  litFraction: Float64Array;
  longestDarkH: Int32Array;
  linkFraction: Float64Array;
  longestBlackoutH: Int32Array;
  landingSunElDeg: Float64Array;
  landingLit: Uint8Array;
};

/** docs/science.md §10. A team setting, kept in sync with `constants.py`. */
export const GO_SCORE_THRESHOLD = 70;

/**
 * Hours in a mission window: floor(24 × duration_days + 0.5), at least 1.
 * docs/science.md §9. `floor` matches the reference; `Math.round` would not.
 */
export function windowLength(durationDays: number): number {
  const n = Math.floor(24 * durationDays + 0.5);
  if (n < 1) {
    throw new Error("mission window must contain at least one hour");
  }
  return n;
}

function validateProfile(profile: ScoringProfile): void {
  if (profile.slope_ideal_deg >= profile.max_slope_deg) {
    throw new Error("slope_ideal_deg must be less than max_slope_deg");
  }
}

function seriesCount(series: Series): number {
  const count = series.sun_frac.length;
  if (series.sun_el.length !== count || series.earth_clear.length !== count) {
    throw new RangeError("series columns must be equally sized vectors");
  }
  return count;
}

function at(values: ArrayLike<number>, index: number): number {
  const value = values[index];
  return value === undefined ? Number.NaN : value;
}

/** Canonical limit comparison and returned score (docs/science.md §9). */
function q(value: number): number {
  return Math.floor(value * 1e12 + 0.5) / 1e12;
}

/** Per-hour lit and link flags (docs/science.md §9). */
export function hourFlags(series: Series, profile: ScoringProfile): HourFlags {
  const count = seriesCount(series);
  const lit = new Uint8Array(count);
  const link = new Uint8Array(count);
  const minSun = q(profile.min_sun_fraction);
  const elMin = profile.ops_sun_el_min_deg === null ? null : q(profile.ops_sun_el_min_deg);
  const mask = q(profile.antenna_mask_deg);
  const relay = profile.relay_available;
  for (let i = 0; i < count; i++) {
    let isLit = q(at(series.sun_frac, i)) >= minSun;
    if (elMin !== null && !(q(at(series.sun_el, i)) >= elMin)) {
      isLit = false;
    }
    lit[i] = isLit ? 1 : 0;
    link[i] = relay || q(at(series.earth_clear, i)) >= mask ? 1 : 0;
  }
  return { lit, link };
}

/**
 * Exact integer prefix counts, then one division (docs/science.md §§9, 11).
 * units is 10,000 for Sun fractions and 1 for the binary hour flags.
 */
function prefixMeans(values: ArrayLike<number>, n: number, landingCount: number, units = 1): Float64Array {
  const prefix = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i++) {
    prefix[i + 1] = prefix[i]! + Math.floor(at(values, i) * units + 0.5);
  }
  const means = new Float64Array(landingCount);
  for (let i = 0; i < landingCount; i++) {
    means[i] = (prefix[i + n]! - prefix[i]!) / (n * units);
  }
  return means;
}

function windowMean(values: ArrayLike<number>, start: number, n: number, units = 1): number {
  let count = 0;
  const stop = start + n;
  for (let i = start; i < stop; i++) {
    count += Math.floor(at(values, i) * units + 0.5);
  }
  return count / (n * units);
}

/** Longest unbroken run inside one window. A direct scan (docs/science.md §9). */
function longestRunInWindow(flags: Uint8Array, start: number, n: number, trueValue: number): number {
  let best = 0;
  let run = 0;
  const stop = start + n;
  for (let i = start; i < stop; i++) {
    if (flags[i] === trueValue) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Longest `trueValue` run inside every window of length `n`.
 *
 * The run breaks (hours that are not `trueValue`) are scanned once.
 * Each window's longest run is the longest of the prefix before the first
 * break, the suffix after the last break, and the full gaps between breaks
 * inside the window. That is the same quantity as scanning each window.
 */
function longestRuns(flags: Uint8Array, n: number, trueValue: number): Int32Array {
  const count = flags.length;
  const windows = count - n + 1;
  const result = new Int32Array(Math.max(0, windows));
  if (windows <= 0) return result;

  const breaks: number[] = [-1];
  for (let i = 0; i < count; i++) {
    if (flags[i] !== trueValue) breaks.push(i);
  }
  breaks.push(count);

  const gaps = new Int32Array(breaks.length - 1);
  for (let j = 0; j < gaps.length; j++) {
    gaps[j] = breaks[j + 1]! - breaks[j]! - 1;
  }
  const rangeMax = buildRangeMax(gaps);

  let first = 0;
  let after = 0;
  const breakCount = breaks.length;
  for (let start = 0; start < windows; start++) {
    const end = start + n;
    while (first < breakCount && breaks[first]! < start) first += 1;
    while (after < breakCount && breaks[after]! < end) after += 1;
    if (first === after) {
      result[start] = n;
      continue;
    }
    const prefix = breaks[first]! - start;
    const suffix = end - 1 - breaks[after - 1]!;
    let best = prefix > suffix ? prefix : suffix;
    if (after - 2 >= first) {
      const gap = rangeMax(first, after - 2);
      if (gap > best) best = gap;
    }
    result[start] = best;
  }
  return result;
}

function buildRangeMax(values: Int32Array): (left: number, right: number) => number {
  const levels: Int32Array[] = [values];
  for (let level = 1; 1 << level <= values.length; level++) {
    const previous = levels[level - 1]!;
    const span = 1 << (level - 1);
    const next = new Int32Array(values.length - (1 << level) + 1);
    for (let i = 0; i < next.length; i++) {
      const left = previous[i]!;
      const right = previous[i + span]!;
      next[i] = left > right ? left : right;
    }
    levels.push(next);
  }
  return (left: number, right: number) => {
    const length = right - left + 1;
    const level = 31 - Math.clz32(length);
    const span = 1 << level;
    const table = levels[level]!;
    const start = table[left]!;
    const end = table[right - span + 1]!;
    return start > end ? start : end;
  };
}

function g(x: number, m: number): number {
  if (q(m) <= 0 || q(x) <= 0) return 1;
  return q(x) >= q(m) ? 0 : Math.max(0, 1 - x / m);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function assertScoreDefined(profile: ScoringProfile, slopeDeg: number | null): void {
  let denominator = profile.weights.power + profile.weights.comms;
  if (slopeDeg !== null) denominator += profile.weights.slope;
  if (denominator === 0) {
    throw new Error("score is undefined when assessed weights sum to zero");
  }
}

/** Vetoes, utilities, score and status (docs/science.md §10). */
function evaluationFromMetrics(
  metrics: Metrics,
  profile: ScoringProfile,
  slopeDeg: number | null,
): Evaluation {
  const vetoes: Vetoes = {
    slope: {
      triggered: slopeDeg !== null && q(slopeDeg) > q(profile.max_slope_deg),
      measured: slopeDeg,
      limit: profile.max_slope_deg,
    },
    darkness: {
      triggered: q(metrics.longestDarkH) > q(profile.max_dark_h),
      measured: metrics.longestDarkH,
      limit: profile.max_dark_h,
    },
    blackout: {
      triggered: !profile.relay_available && q(metrics.longestBlackoutH) > q(profile.max_blackout_h),
      measured: metrics.longestBlackoutH,
      limit: profile.max_blackout_h,
    },
    landing_dark: {
      triggered: !metrics.landingLit,
      measured: metrics.landingLit,
      limit: true,
    },
    landing_sun_low: {
      triggered:
        profile.landing_sun_el_min_deg !== null &&
        q(metrics.landingSunElDeg) < q(profile.landing_sun_el_min_deg),
      measured: metrics.landingSunElDeg,
      limit: profile.landing_sun_el_min_deg,
    },
    landing_sun_high: {
      triggered:
        profile.landing_sun_el_max_deg !== null &&
        q(metrics.landingSunElDeg) > q(profile.landing_sun_el_max_deg),
      measured: metrics.landingSunElDeg,
      limit: profile.landing_sun_el_max_deg,
    },
  };

  let slope: number | null = null;
  if (slopeDeg !== null) {
    if (q(slopeDeg) <= q(profile.slope_ideal_deg)) slope = 1;
    else if (q(slopeDeg) >= q(profile.max_slope_deg)) slope = 0;
    else slope = clamp01(
      (profile.max_slope_deg - slopeDeg) / (profile.max_slope_deg - profile.slope_ideal_deg),
    );
  }
  const power = metrics.sunFractionMean * g(metrics.longestDarkH, profile.max_dark_h);
  const comms = profile.relay_available
    ? 1
    : metrics.linkFraction * g(metrics.longestBlackoutH, profile.max_blackout_h);

  // Power, then comms, then slope. Then 100 × numerator / denominator.
  const weights = profile.weights;
  let numerator = weights.power * power + weights.comms * comms;
  let denominator = weights.power + weights.comms;
  if (slope !== null) {
    numerator += weights.slope * slope;
    denominator += weights.slope;
  }
  if (denominator === 0) {
    throw new Error("score is undefined when assessed weights sum to zero");
  }
  const score = q((100 * numerator) / denominator);

  let status: Status = "CAUTION";
  if (
    vetoes.slope.triggered ||
    vetoes.darkness.triggered ||
    vetoes.blackout.triggered ||
    vetoes.landing_dark.triggered ||
    vetoes.landing_sun_low.triggered ||
    vetoes.landing_sun_high.triggered
  ) {
    status = "NO-GO";
  } else if (score >= GO_SCORE_THRESHOLD) {
    status = "GO";
  }

  return {
    metrics,
    vetoes,
    utilities: { slope, power, comms },
    score,
    status,
    slopeNotAssessed: slope === null,
  };
}

function metricsAt(
  series: Series,
  flags: HourFlags,
  landingHour: number,
  n: number,
): Metrics {
  return {
    sunFractionMean: windowMean(series.sun_frac, landingHour, n, 10000),
    litFraction: windowMean(flags.lit, landingHour, n),
    longestDarkH: longestRunInWindow(flags.lit, landingHour, n, 0),
    linkFraction: windowMean(flags.link, landingHour, n),
    longestBlackoutH: longestRunInWindow(flags.link, landingHour, n, 0),
    landingSunElDeg: at(series.sun_el, landingHour),
    landingLit: flags.lit[landingHour] === 1,
  };
}

/** One mission window, or null when it runs past the end of the grid. */
export function evaluate(
  series: Series,
  profile: ScoringProfile,
  landingHour: number,
  slopeDeg: number | null,
): Evaluation | null {
  const count = seriesCount(series);
  validateProfile(profile);
  const n = windowLength(profile.duration_days);
  if (landingHour < 0 || landingHour >= count) {
    throw new RangeError("landing hour is outside the time grid");
  }
  if (landingHour + n > count) return null;
  const flags = hourFlags(series, profile);
  return evaluationFromMetrics(metricsAt(series, flags, landingHour, n), profile, slopeDeg);
}

/** Every landing hour, as typed arrays (docs/science.md §§9–11). */
export function slipSweep(
  series: Series,
  profile: ScoringProfile,
  slopeDeg: number | null,
): SlipSweep {
  const count = seriesCount(series);
  validateProfile(profile);
  const n = windowLength(profile.duration_days);
  if (n > count) {
    return emptySweep(count, n, slopeDeg);
  }
  assertScoreDefined(profile, slopeDeg);
  const flags = hourFlags(series, profile);
  const landingCount = count - n + 1;
  const landingSunElDeg = new Float64Array(landingCount);
  const landingLit = new Uint8Array(landingCount);
  for (let i = 0; i < landingCount; i++) {
    landingSunElDeg[i] = at(series.sun_el, i);
    landingLit[i] = flags.lit[i]!;
  }
  return {
    hourCount: count,
    windowHours: n,
    landingCount,
    slopeDeg,
    sunFractionMean: prefixMeans(series.sun_frac, n, landingCount, 10000),
    litFraction: prefixMeans(flags.lit, n, landingCount),
    longestDarkH: longestRuns(flags.lit, n, 0),
    linkFraction: prefixMeans(flags.link, n, landingCount),
    longestBlackoutH: longestRuns(flags.link, n, 0),
    landingSunElDeg,
    landingLit,
  };
}

function emptySweep(hourCount: number, windowHours: number, slopeDeg: number | null): SlipSweep {
  return {
    hourCount,
    windowHours,
    landingCount: 0,
    slopeDeg,
    sunFractionMean: new Float64Array(0),
    litFraction: new Float64Array(0),
    longestDarkH: new Int32Array(0),
    linkFraction: new Float64Array(0),
    longestBlackoutH: new Int32Array(0),
    landingSunElDeg: new Float64Array(0),
    landingLit: new Uint8Array(0),
  };
}

/**
 * Rebuild one landing from a sweep. Null when the window does not fit.
 * Uses the metrics stored on the sweep and applies §10 with `profile`.
 */
export function evaluationAt(
  sweep: SlipSweep,
  profile: ScoringProfile,
  landingHour: number,
): Evaluation | null {
  validateProfile(profile);
  if (landingHour < 0 || landingHour >= sweep.hourCount) {
    throw new RangeError("landing hour is outside the time grid");
  }
  if (landingHour >= sweep.landingCount) return null;
  const metrics: Metrics = {
    sunFractionMean: sweep.sunFractionMean[landingHour]!,
    litFraction: sweep.litFraction[landingHour]!,
    longestDarkH: sweep.longestDarkH[landingHour]!,
    linkFraction: sweep.linkFraction[landingHour]!,
    longestBlackoutH: sweep.longestBlackoutH[landingHour]!,
    landingSunElDeg: sweep.landingSunElDeg[landingHour]!,
    landingLit: sweep.landingLit[landingHour] === 1,
  };
  return evaluationFromMetrics(metrics, profile, sweep.slopeDeg);
}

/**
 * Hour indices whose timestamp is 00:00 UTC.
 * The time grid starts at 2026-01-01T00:00:00Z, so those hours are 0, 24, 48, …
 * Pass the full-grid length, not a slice that starts at some other hour.
 */
export function utcMidnightHours(hourCount: number): Int32Array {
  if (hourCount <= 0) return new Int32Array(0);
  const count = Math.floor((hourCount - 1) / 24) + 1;
  const hours = new Int32Array(count);
  for (let i = 0; i < count; i++) hours[i] = i * 24;
  return hours;
}

/** The Slip Planner's rows: one evaluation per 00:00 UTC landing. */
export function evaluationsAtUtcMidnight(
  sweep: SlipSweep,
  profile: ScoringProfile,
): Array<Evaluation | null> {
  const hours = utcMidnightHours(sweep.hourCount);
  const rows: Array<Evaluation | null> = [];
  for (let i = 0; i < hours.length; i++) {
    rows.push(evaluationAt(sweep, profile, hours[i]!));
  }
  return rows;
}

type Condition = {
  values: ArrayLike<number>;
  threshold: number;
};

/**
 * Next lit and link changes, in hours after `currentHour` (docs/science.md §9).
 * A relay's link never changes, so both Earth countdowns are none.
 * None also means no change before the end of the grid.
 */
export function countdowns(
  series: Series,
  profile: ScoringProfile,
  currentHour: number,
): Countdowns {
  const count = seriesCount(series);
  if (currentHour < 0 || currentHour >= count) {
    throw new RangeError("current hour is outside the time grid");
  }
  const flags = hourFlags(series, profile);
  const sunConditions: Condition[] = [{ values: series.sun_frac, threshold: profile.min_sun_fraction }];
  if (profile.ops_sun_el_min_deg !== null) {
    sunConditions.push({ values: series.sun_el, threshold: profile.ops_sun_el_min_deg });
  }
  const earthConditions: Condition[] = [
    { values: series.earth_clear, threshold: profile.antenna_mask_deg },
  ];
  return {
    sunset: crossing(flags.lit, sunConditions, currentHour, false),
    sunrise: crossing(flags.lit, sunConditions, currentHour, true),
    earthset: crossing(flags.link, earthConditions, currentHour, false),
    earthrise: crossing(flags.link, earthConditions, currentHour, true),
  };
}

function crossing(
  flags: Uint8Array,
  conditions: Condition[],
  currentHour: number,
  rising: boolean,
): number | null {
  const count = flags.length;
  let index = -1;
  for (let i = currentHour; i < count - 1; i++) {
    const before = flags[i] === 1;
    const after = flags[i + 1] === 1;
    const changed = rising ? !before && after : before && !after;
    if (changed) {
      index = i;
      break;
    }
  }
  if (index < 0) return null;

  const times: number[] = [];
  for (const condition of conditions) {
    const left = q(at(condition.values, index));
    const right = q(at(condition.values, index + 1));
    const threshold = q(condition.threshold);
    const changed = rising
      ? left < threshold && threshold <= right
      : left >= threshold && threshold > right;
    if (changed) {
      times.push((threshold - left) / (right - left));
    }
  }
  if (times.length === 0) {
    throw new Error("flag changed but no condition crossed its threshold");
  }
  let extreme = times[0]!;
  for (let i = 1; i < times.length; i++) {
    const time = times[i]!;
    if (rising ? time > extreme : time < extreme) extreme = time;
  }
  return index - currentHour + extreme;
}
