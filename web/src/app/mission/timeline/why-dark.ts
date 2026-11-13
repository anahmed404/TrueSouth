/**
 * "Why is it dark?": what hides the Sun (or Earth) at the current hour, read from stored
 * data only. The body's azimuth, elevation, disc fraction and clearance come from the
 * series (docs/science.md §7); the skyline height at the body's azimuth is its elevation
 * minus its clearance, exactly as the series stores them; the blocker is the one stored in
 * the nearest skyline bin (docs/data-contracts.md, `skyline.bin`). Nothing here traces
 * terrain or computes where the Sun is.
 */

import type { Feature } from "../../../contracts/generated";
import { formatNumber } from "../../../components/format";
import { MOON_RADIUS_M, skylineBinCentreDeg, skylineBinForAzimuth, unitVector } from "../../../lib/geo";
import { distinctDecimals, formatLimit } from "../rules";

/** The five arrays of `skyline.bin`, as `useSkyline` returns them. */
export type SkylineArrays = {
  el_deg: ArrayLike<number>;
  dist_km: ArrayLike<number>;
  lat_deg: ArrayLike<number>;
  lon_deg: ArrayLike<number>;
  height_m: ArrayLike<number>;
};

/** The terrain point that sets the skyline in one bin. */
export type Blocker = {
  bin: number;
  /** The bin's centre azimuth: the compass bearing from the site to the blocker. */
  bearingDeg: number;
  distKm: number;
  heightM: number;
  latDeg: number;
  lonDeg: number;
};

/**
 * The blocker in the skyline bin nearest to `azDeg` (0.25° bins; 359.9° wraps to bin 0).
 * Null when the bin has no blocker: a sphere-tier site, or a bin whose data is missing.
 */
export function blockerAt(skyline: SkylineArrays, azDeg: number): Blocker | null {
  const bins = skyline.el_deg.length;
  if (bins === 0 || !Number.isFinite(azDeg)) return null;
  const bin = skylineBinForAzimuth(azDeg, bins);
  const distKm = skyline.dist_km[bin] ?? Number.NaN;
  const latDeg = skyline.lat_deg[bin] ?? Number.NaN;
  const lonDeg = skyline.lon_deg[bin] ?? Number.NaN;
  const heightM = skyline.height_m[bin] ?? Number.NaN;
  if (![distKm, latDeg, lonDeg, heightM].every(Number.isFinite)) return null;
  return { bin, bearingDeg: skylineBinCentreDeg(bin, bins), distKm, heightM, latDeg, lonDeg };
}

/**
 * How far from a named feature's centre a blocker may lie and still be named after it, as
 * a share of the feature's diameter: half the diameter is the rim, and 0.6 allows a rim
 * that stands a little outside the published circle.
 */
export const FEATURE_REACH = 0.6;

/** Great-circle distance on the reference sphere, in kilometres. */
export function surfaceDistanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const a = unitVector(latA, lonA);
  const b = unitVector(latB, lonB);
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(dot) * MOON_RADIUS_M) / 1000;
}

/**
 * The named feature a blocker belongs to, by one rule: the blocker lies within
 * `FEATURE_REACH × diameter` of the feature's centre. When several qualify (a crater on a
 * mountain), the smallest feature is the most specific. Null when none does: then the
 * card gives only the bearing and distance.
 */
export function namedFeatureAt(latDeg: number, lonDeg: number, features: readonly Feature[]): Feature | null {
  let best: Feature | null = null;
  for (const feature of features) {
    if (!(feature.diameter_km > 0)) continue;
    const distance = surfaceDistanceKm(latDeg, lonDeg, feature.lat_deg, feature.lon_deg);
    if (distance > FEATURE_REACH * feature.diameter_km) continue;
    if (!best || feature.diameter_km < best.diameter_km) best = feature;
  }
  return best;
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

/** The nearest of eight compass words for an azimuth: 265.75° is "west". */
export function compassWord(azDeg: number): string {
  const wrapped = ((azDeg % 360) + 360) % 360;
  return COMPASS[Math.round(wrapped / 45) % 8] ?? "north";
}

/** The body's values at the current hour, straight from the series. */
export type BodyNow = { azDeg: number; elDeg: number; frac: number; clearDeg: number };

export type Cause =
  /** Lit, or linked: nothing to explain. */
  | "clear"
  /** A relay carries the link, so Earth's position does not matter. */
  | "relay"
  /** Terrain stands in front of the body while its centre is above level. */
  | "terrain"
  /** The body's centre is below level; the skyline in that direction still hides it. */
  | "below_horizon"
  /** A sphere-tier site: no terrain, the horizon is the smooth Moon's. */
  | "smooth_horizon"
  /** The Sun is clear of the terrain but lower than the profile's operations rule. */
  | "too_low"
  /** Earth's centre is above the skyline but under the antenna mask. */
  | "under_mask";

export type Explanation = {
  body: "sun" | "earth";
  ok: boolean;
  cause: Cause;
  now: BodyNow;
  /** The skyline's height at the body's azimuth: elevation minus clearance. */
  skylineDeg: number;
  blocker: Blocker | null;
  feature: Feature | null;
};

export type SunRule = { minFraction: number; minElDeg: number | null };

type Context = {
  skyline: SkylineArrays | null;
  features: readonly Feature[];
  sphere: boolean;
};

function located(now: BodyNow, context: Context): Pick<Explanation, "skylineDeg" | "blocker" | "feature"> {
  const blocker = context.sphere || !context.skyline ? null : blockerAt(context.skyline, now.azDeg);
  return {
    skylineDeg: now.elDeg - now.clearDeg,
    blocker,
    feature: blocker ? namedFeatureAt(blocker.latDeg, blocker.lonDeg, context.features) : null,
  };
}

function hiddenCause(now: BodyNow, sphere: boolean): Cause {
  if (sphere) return "smooth_horizon";
  return now.elDeg < 0 ? "below_horizon" : "terrain";
}

/** Why the Sun is or is not lit at this hour, under the profile's rule (docs/science.md §9). */
export function explainSun(now: BodyNow, lit: boolean, rule: SunRule, context: Context): Explanation {
  const where = located(now, context);
  if (lit) return { body: "sun", ok: true, cause: "clear", now, ...where };
  const cause = now.frac >= rule.minFraction ? "too_low" : hiddenCause(now, context.sphere);
  return { body: "sun", ok: false, cause, now, ...where };
}

/** Why there is or is not a link at this hour, under the profile's rule (docs/science.md §9). */
export function explainEarth(now: BodyNow, link: boolean, relay: boolean, context: Context): Explanation {
  const where = located(now, context);
  if (relay) return { body: "earth", ok: true, cause: "relay", now, ...where };
  if (link) return { body: "earth", ok: true, cause: "clear", now, ...where };
  const cause = now.clearDeg >= 0 ? "under_mask" : hiddenCause(now, context.sphere);
  return { body: "earth", ok: false, cause, now, ...where };
}

/** "80 m", "12.4 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${formatNumber(Math.round(km * 100) * 10)} m`;
  return `${formatNumber(km, 1)} km`;
}

/** "2,081 m", "−1,204 m". */
export function formatHeight(metres: number): string {
  const text = formatNumber(Math.round(metres));
  return `${text.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m`;
}

/** "265.75° (west)". */
export function formatBearing(azDeg: number): string {
  return `${formatNumber(azDeg, 2)}° (${compassWord(azDeg)})`;
}

function angle(value: number, decimals: number): string {
  return `${formatNumber(value, decimals)}°`;
}

/** "1.08° up", "1.38° below level". */
function height(name: string, elDeg: number, decimals: number): string {
  return elDeg < 0 ? `${name} is ${angle(-elDeg, decimals)} below level` : `${name} is ${angle(elDeg, decimals)} up`;
}

/** The words of one explanation. `rule` is followed by the profile setting's tag. */
export type Wording = {
  /** One or two plain sentences built from the data. */
  text: string;
  /** A rule of the profile, with a number that needs its sourced or assumed tag, or null. */
  rule: string | null;
  /** "Blocked by terrain." and the like, or null. */
  verdict: string | null;
};

/** The sentence the card shows. `rule` is the profile setting the explanation leans on. */
export function wordExplanation(
  explanation: Explanation,
  rule: { minFraction: number; minElDeg: number | null; antennaMaskDeg: number },
): Wording {
  const { now, skylineDeg, blocker, feature } = explanation;
  const name = explanation.body === "sun" ? "The Sun" : "Earth";
  const d = distinctDecimals(now.elDeg, skylineDeg, 2);

  switch (explanation.cause) {
    case "relay":
      return { text: "A relay passes the signal on, so Earth's position does not decide the link.", rule: null, verdict: null };
    case "clear":
      return {
        text: `${height(name, now.elDeg, 2)}, ${angle(now.clearDeg, 2)} above the skyline.`,
        rule: null,
        verdict: null,
      };
    case "too_low": {
      const min = rule.minElDeg ?? 0;
      const e = distinctDecimals(now.elDeg, min, 2);
      return {
        text: `${name} is clear of the terrain, but only ${angle(now.elDeg, e)} up.`,
        rule: `This profile counts an hour as lit only from ${formatLimit(min, "°")}`,
        verdict: null,
      };
    }
    case "under_mask": {
      const c = distinctDecimals(now.clearDeg, rule.antennaMaskDeg, 2);
      return {
        text: `${name} is ${angle(now.clearDeg, c)} above the skyline toward ${formatBearing(now.azDeg)}.`,
        rule: `The antenna needs ${formatLimit(rule.antennaMaskDeg, "°")}`,
        verdict: "Too low for a link.",
      };
    }
    case "smooth_horizon": {
      const partial = now.frac > 0;
      return {
        text: `${height(name, now.elDeg, d)}. This site has no terrain model, so its horizon is the smooth Moon's, at ${angle(skylineDeg, d)}.`,
        rule: partial ? partialRule(explanation, rule) : null,
        verdict: partial ? "Partly below the horizon." : "Below the horizon.",
      };
    }
    case "terrain":
    case "below_horizon": {
      const toward = `toward ${formatBearing(now.azDeg)}`;
      const ground = blocker
        ? `, set by ground ${formatDistance(blocker.distKm)} away${feature ? ` at ${feature.name}` : ""}`
        : "";
      const skyline =
        explanation.cause === "terrain"
          ? `The skyline ${toward} rises to ${angle(skylineDeg, d)}${ground}.`
          : `The skyline ${toward} is at ${angle(skylineDeg, d)}${ground}.`;
      const partial = now.frac > 0;
      return {
        text: `${height(name, now.elDeg, d)}. ${skyline}`,
        rule: partial && explanation.body === "sun" ? partialRule(explanation, rule) : null,
        verdict: explanation.cause === "terrain" ? "Blocked by terrain." : "Below the horizon.",
      };
    }
  }
}

function partialRule(explanation: Explanation, rule: { minFraction: number }): string {
  const f = distinctDecimals(explanation.now.frac, rule.minFraction, 2);
  return `Only ${formatNumber(explanation.now.frac, f)} of its disc shows; this profile needs ${formatLimit(rule.minFraction, "")}`;
}
