import type { DecodedSystem } from "../../../../data";
import { bandSegments, type Segment } from "../../../../app/mission/timeline/axis";
import type { HourFlags } from "../../../../lib/scoring";
import { drawnDistance } from "../../../three/scene/proportions";
import { bodyAt, type BodyNow, type ChartSeries } from "../../../panorama/readings";
import type { HourRange } from "../../drag-body";

/**
 * What the lessons' panel reveals draw, read from the stored files only: a site's series and
 * skyline, and `system.bin`. Pure, so a test can check each picture's numbers against the
 * worked examples the lesson's words quote. Nothing here works out where the Sun or Earth is
 * (docs/decisions/0002-scoring-in-browser.md): it places stored values.
 */

// ── Lander's eye: one moment at a site ────────────────────────────────────────

export type HorizonMoment = { sun: BodyNow | null; earth: BodyNow | null };

/** The Sun and Earth as stored at `hour`: azimuth, elevation, disc fraction and clearance. */
export function horizonMoment(series: ChartSeries, hour: number): HorizonMoment {
  return { sun: bodyAt(series, "sun", hour), earth: bodyAt(series, "earth", hour) };
}

// ── System view: where the Sun and Earth are around the Moon ──────────────────

/**
 * One hour of the System view's drawing, seen from below the Moon's south pole (Pip's pole at
 * the centre, 0° longitude up, east to the right). Positions are in Moon radii.
 * - The Sun's direction is its sub-solar point's (`system.bin`); it is drawn at the frame's
 *   edge, because at the System view's schematic distance it is about ten times farther than
 *   Earth (`proportions.ts`).
 * - Earth is drawn at the System view's schematic distance for its stored distance.
 */
export type SystemFrame = {
  hour: number;
  /** The Sun's direction on the drawing, degrees clockwise from up: its sub-solar longitude. */
  sunAngleDeg: number;
  earthX: number;
  earthY: number;
  /** Earth's drawn distance from the Moon's centre, in Moon radii. */
  earthDistance: number;
};

const RADIANS = Math.PI / 180;

function wrap360(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * The drawing's frame at `hour`, or null when `system.bin` has no record there. Seen from
 * below the south pole, a point at latitude φ and east longitude λ projects to
 * (cos φ sin λ, cos φ cos λ): looking along the Moon's axis from the south, with 0° up,
 * east is to the right.
 */
export function systemFrame(system: DecodedSystem, hour: number): SystemFrame | null {
  const sunLon = system.subsolar_lon[hour];
  const earthLat = system.subearth_lat[hour];
  const earthLon = system.subearth_lon[hour];
  const earthKm = system.earth_dist_km[hour];
  if ([sunLon, earthLat, earthLon, earthKm].some((value) => value === undefined || !Number.isFinite(value))) return null;
  const distance = drawnDistance(earthKm as number);
  const lat = (earthLat as number) * RADIANS;
  const lon = (earthLon as number) * RADIANS;
  return {
    hour,
    sunAngleDeg: wrap360(sunLon as number),
    earthX: distance * Math.cos(lat) * Math.sin(lon),
    earthY: distance * Math.cos(lat) * Math.cos(lon),
    earthDistance: distance,
  };
}

/** The frames over a range of hours, every `step` hours, ending on the last hour. */
export function systemFrames(system: DecodedSystem, range: HourRange, step = 6): SystemFrame[] {
  const out: SystemFrame[] = [];
  for (let hour = range.fromIndex; hour <= range.toIndex; hour += step) {
    const frame = systemFrame(system, hour);
    if (frame) out.push(frame);
  }
  const last = systemFrame(system, range.toIndex);
  if (last && out[out.length - 1]?.hour !== range.toIndex) out.push(last);
  return out;
}

/** How far the Sun's direction turns over a range, in degrees, following it hour by hour. */
export function sunTurnDeg(system: DecodedSystem, range: HourRange): number {
  let total = 0;
  let previous: number | null = null;
  for (let hour = range.fromIndex; hour <= range.toIndex; hour += 1) {
    const lon = system.subsolar_lon[hour];
    if (lon === undefined || !Number.isFinite(lon)) continue;
    if (previous !== null) total += Math.abs(((lon - previous + 540) % 360) - 180);
    previous = lon;
  }
  return total;
}

// ── Timeline: a month of Sun and Earth bands ──────────────────────────────────

export type MonthBands = {
  range: HourRange;
  /** The timeline's Sun band: lit hours under the profile's rule, at the height of the disc fraction. */
  sun: Segment[];
  /**
   * Hours when any of Earth's disc shows above the skyline (`earth_frac` above 0), drawn with
   * the timeline's band logic. The timeline's own Earth band is link hours under the profile's
   * antenna mask; lesson 4 asks about Earth being in Pip's sky, so this band shows that.
   */
  earth: Segment[];
  hours: number;
  litHours: number;
  earthUpHours: number;
};

export function monthBands(series: Pick<ChartSeries, "sun_frac" | "earth_frac">, flags: { lit: HourFlags["lit"] | ArrayLike<number> }, range: HourRange): MonthBands {
  const hours = range.toIndex - range.fromIndex + 1;
  const earthUp = new Uint8Array(series.earth_frac.length);
  let earthUpHours = 0;
  let litHours = 0;
  for (let hour = range.fromIndex; hour <= range.toIndex; hour += 1) {
    if ((series.earth_frac[hour] ?? 0) > 0) {
      earthUp[hour] = 1;
      earthUpHours += 1;
    }
    if (flags.lit[hour] === 1) litHours += 1;
  }
  // The whole month counts as the window, so every segment is drawn at full strength.
  const edges = { start: range.fromIndex, end: range.toIndex, landing: range.fromIndex, windowEnd: range.toIndex + 1 };
  return {
    range,
    sun: bandSegments(flags.lit, edges, (hour) => series.sun_frac[hour] ?? 0),
    earth: bandSegments(earthUp, edges),
    hours,
    litHours,
    earthUpHours,
  };
}
