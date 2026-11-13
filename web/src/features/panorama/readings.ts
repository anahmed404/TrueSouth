/**
 * What the horizon chart says, read from stored data only (docs/features/panorama.md).
 *
 * "In view" and "behind the skyline" come from the series' disc fraction for that hour,
 * never from what the chart draws (docs/features/panorama.md, "What is behind and what
 * floats above"). Skyline readings come straight from the bin's stored arrays
 * (docs/data-contracts.md, `skyline.bin`).
 */

import type { Feature } from "../../contracts/generated";
import { formatNumber, formatUtc } from "../../components/format";
import { skylineBinCentreDeg, skylineBinForAzimuth } from "../../lib/geo";
import { blockerAt, namedFeatureAt, type Blocker, type SkylineArrays } from "../../app/mission/timeline/why-dark";

export type BodyId = "sun" | "earth";

/** The series columns the chart reads. */
export type ChartSeries = {
  sun_az: ArrayLike<number>;
  sun_el: ArrayLike<number>;
  sun_frac: ArrayLike<number>;
  sun_clear: ArrayLike<number>;
  earth_az: ArrayLike<number>;
  earth_el: ArrayLike<number>;
  earth_frac: ArrayLike<number>;
  earth_clear: ArrayLike<number>;
};

/** One body's stored values at one hour. */
export type BodyNow = { body: BodyId; hour: number; azDeg: number; elDeg: number; frac: number; clearDeg: number };

/** The body's four stored values at `hour`, or null when any is missing. */
export function bodyAt(series: ChartSeries, body: BodyId, hour: number): BodyNow | null {
  const sun = body === "sun";
  const azDeg = (sun ? series.sun_az : series.earth_az)[hour] ?? Number.NaN;
  const elDeg = (sun ? series.sun_el : series.earth_el)[hour] ?? Number.NaN;
  const frac = (sun ? series.sun_frac : series.earth_frac)[hour] ?? Number.NaN;
  const clearDeg = (sun ? series.sun_clear : series.earth_clear)[hour] ?? Number.NaN;
  if (![azDeg, elDeg, frac, clearDeg].every(Number.isFinite)) return null;
  return { body, hour, azDeg, elDeg, frac, clearDeg };
}

/** How much of the disc shows, from the series' disc fraction. */
export type Visibility = "in_view" | "partly" | "blocked";

/** All of the disc clear is "in view"; none of it is "blocked"; anything between is "partly". */
export function visibility(frac: number): Visibility {
  if (frac >= 1) return "in_view";
  if (frac <= 0) return "blocked";
  return "partly";
}

export const VISIBILITY_WORDS: Record<Visibility, string> = {
  in_view: "in view",
  partly: "partly behind the skyline",
  blocked: "behind the skyline",
};

export const BODY_NAME: Record<BodyId, string> = { sun: "Sun", earth: "Earth" };

function degrees(value: number, decimals = 2): string {
  return `${formatNumber(value, decimals)}°`;
}

/** "0.80° up", "1.38° below level". */
export function heightWords(elDeg: number): string {
  return elDeg < 0 ? `${degrees(-elDeg)} below level` : `${degrees(elDeg)} up`;
}

/** The label's first line: "Sun, behind the skyline". */
export function labelTitle(now: BodyNow): string {
  return `${BODY_NAME[now.body]}, ${VISIBILITY_WORDS[visibility(now.frac)]}`;
}

/** The label's second line: "0.80° up · disc fraction 0.01", "2.97° up · clearance 2.46°". */
export function labelDetail(now: BodyNow): string {
  return now.body === "sun"
    ? `${heightWords(now.elDeg)} · disc fraction ${formatNumber(now.frac, 2)}`
    : `${heightWords(now.elDeg)} · clearance ${degrees(now.clearDeg)}`;
}

/** "Sun 0.80° up, behind the skyline". */
export function bodySentence(now: BodyNow): string {
  return `${BODY_NAME[now.body]} ${heightWords(now.elDeg)}, ${VISIBILITY_WORDS[visibility(now.frac)]}`;
}

/** The chart's answer in words: "Sun 0.80° up, behind the skyline; Earth 0.90° up, in view." */
export function answerSentence(sun: BodyNow | null, earth: BodyNow | null): string {
  const parts = [sun, earth].filter((b): b is BodyNow => b !== null).map(bodySentence);
  return parts.length ? `${parts.join("; ")}.` : "No Sun or Earth position is stored for this time.";
}

// ── The skyline at the pointer ───────────────────────────────────────────────

export type SkylineReading = {
  bin: number;
  /** The bin's centre azimuth. */
  azDeg: number;
  elDeg: number;
  blocker: Blocker | null;
  feature: Feature | null;
};

/** The stored skyline in the bin nearest `azDeg`: its elevation, its blocker and the named feature the blocker is on. */
export function skylineReading(skyline: SkylineArrays, azDeg: number, features: readonly Feature[]): SkylineReading {
  const bins = skyline.el_deg.length;
  const bin = skylineBinForAzimuth(azDeg, bins);
  const blocker = blockerAt(skyline, azDeg);
  return {
    bin,
    azDeg: skylineBinCentreDeg(bin, bins),
    elDeg: skyline.el_deg[bin] ?? Number.NaN,
    blocker,
    feature: blocker ? namedFeatureAt(blocker.latDeg, blocker.lonDeg, features) : null,
  };
}

/** "Day 3 · 2028-03-03 00:00 UTC": the mission day counts from 1 at the landing hour. */
export function tickWhen(utc: string, hour: number, landingHour: number): string {
  return `Day ${Math.floor((hour - landingHour) / 24) + 1} · ${formatUtc(utc)}`;
}
