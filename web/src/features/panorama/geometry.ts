/**
 * The horizon chart's drawing geometry (docs/features/panorama.md, "The horizon chart").
 *
 * Display only. Every angle drawn here is read from stored data: the skyline from
 * `skyline.bin`'s `el_deg`, the Sun and Earth from the series (docs/science.md §5 and §7).
 * Nothing here traces terrain or works out where a body is; it only places stored values
 * on a 360° strip. Angles are degrees, as everywhere outside a formula.
 */

import { scaleLinear, type ScaleLinear } from "d3-scale";
import { skylineBinCentreDeg, wrapAzimuth } from "../../lib/geo";

/** How far an azimuth sits from the chart's centre, in [−180, 180). East of the centre is positive. */
export function offsetFrom(centreDeg: number, azDeg: number): number {
  return wrapAzimuth(azDeg - centreDeg + 180) - 180;
}

// ── Frame and scales ─────────────────────────────────────────────────────────

/** The chart's pixel box and the plot inside it, in CSS pixels. */
export type ChartFrame = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Room for the elevation labels at the left, and the compass under the plot. */
const MARGIN = { left: 34, right: 8, top: 8, bottom: 30 };

/**
 * The chart's frame for a given width. The plot is about a fifth as tall as it is wide,
 * as in the approved prototype, within a floor that keeps a 360 px lesson box readable
 * and a ceiling that leaves the scene room above the floating panel.
 */
export function chartFrame(width: number): ChartFrame {
  const w = Math.max(240, Math.round(width));
  const plotWidth = w - MARGIN.left - MARGIN.right;
  const plotHeight = Math.round(Math.min(180, Math.max(112, plotWidth * 0.22)));
  return {
    width: w,
    height: MARGIN.top + plotHeight + MARGIN.bottom,
    left: MARGIN.left,
    right: w - MARGIN.right,
    top: MARGIN.top,
    bottom: MARGIN.top + plotHeight,
  };
}

export type ElevationRange = { lo: number; hi: number };

export type ChartScales = {
  frame: ChartFrame;
  /** The azimuth at the middle of the chart. */
  centreDeg: number;
  /** Offset from the centre (−180 to 180) to x. */
  x: ScaleLinear<number, number>;
  /** Elevation to y. */
  y: ScaleLinear<number, number>;
  range: ElevationRange;
  pxPerDeg: number;
  pyPerDeg: number;
  /** How much the vertical scale is stretched against the horizontal one. */
  stretch: number;
};

export function chartScales(frame: ChartFrame, centreDeg: number, range: ElevationRange): ChartScales {
  const x = scaleLinear().domain([-180, 180]).range([frame.left, frame.right]);
  const y = scaleLinear().domain([range.lo, range.hi]).range([frame.bottom, frame.top]);
  const pxPerDeg = (frame.right - frame.left) / 360;
  const pyPerDeg = (frame.bottom - frame.top) / (range.hi - range.lo);
  return { frame, centreDeg, x, y, range, pxPerDeg, pyPerDeg, stretch: pyPerDeg / pxPerDeg };
}

/** The x of an azimuth on the chart. */
export function xOfAzimuth(scales: ChartScales, azDeg: number): number {
  return scales.x(offsetFrom(scales.centreDeg, azDeg));
}

/** The azimuth under an x on the chart, in [0, 360). */
export function azimuthAtX(scales: ChartScales, px: number): number {
  const offset = Math.min(180, Math.max(-180, scales.x.invert(px)));
  return wrapAzimuth(scales.centreDeg + offset);
}

/** "vertical ×12", "vertical ×1.5", "no stretch". */
export function stretchWords(stretch: number): string {
  if (stretch > 0.95 && stretch < 1.05) return "No stretch";
  const value = stretch >= 3 ? String(Math.round(stretch)) : stretch.toFixed(1);
  return `Vertical ×${value}`;
}

// ── The skyline, bin by bin ──────────────────────────────────────────────────

export type SkylineVertex = { bin: number; offset: number; el: number };

/**
 * The skyline's vertices across the chart: one per skyline bin, at the bin's centre
 * azimuth and its stored `el_deg`, unchanged. Between vertices the drawn line is straight,
 * which is the stored skyline's own rule between bins (docs/science.md §5). The first and
 * last vertex lie just past the chart's edges (the neighbouring bins), so the line reaches
 * both edges; the plot clips them.
 */
export function skylineVertices(elDeg: ArrayLike<number>, centreDeg: number): SkylineVertex[] {
  const bins = elDeg.length;
  if (bins === 0) return [];
  const step = 360 / bins;
  const leftAz = wrapAzimuth(centreDeg - 180);
  // The first bin whose centre is at or east of the chart's left edge.
  const first = Math.ceil(leftAz / step - 1e-9) % bins;
  const base = wrapAzimuth(skylineBinCentreDeg(first, bins) - leftAz);
  const vertices: SkylineVertex[] = [];
  for (let i = -1; i <= bins; i++) {
    const bin = (((first + i) % bins) + bins) % bins;
    vertices.push({ bin, offset: -180 + base + i * step, el: elDeg[bin] ?? Number.NaN });
  }
  return vertices;
}

/** The skyline's elevation under an offset on the chart, as the drawn line has it. */
export function skylineElAtOffset(vertices: readonly SkylineVertex[], offset: number): number {
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1];
    const b = vertices[i];
    if (!a || !b) continue;
    if (offset >= a.offset && offset <= b.offset) {
      const t = b.offset === a.offset ? 0 : (offset - a.offset) / (b.offset - a.offset);
      return a.el + t * (b.el - a.el);
    }
  }
  return Number.NaN;
}

// ── The Sun's and Earth's paths over the mission window ──────────────────────

export type TrackPoint = { hour: number; offset: number; el: number };

/**
 * One body's path over hours `[from, to)` of the series, as polylines on the chart. The
 * path is split where it wraps past the chart's edge (a jump of more than half the chart
 * between neighbouring hours); each side of the split gets the other side's point, moved by
 * 360°, so both pieces run to the edge. Hours whose values are missing are skipped.
 */
export function trackSegments(
  azDeg: ArrayLike<number>,
  elDeg: ArrayLike<number>,
  from: number,
  to: number,
  centreDeg: number,
): TrackPoint[][] {
  const segments: TrackPoint[][] = [];
  let current: TrackPoint[] = [];
  let previous: TrackPoint | null = null;
  const end = Math.min(to, azDeg.length, elDeg.length);
  for (let hour = Math.max(0, from); hour < end; hour++) {
    const az = azDeg[hour] ?? Number.NaN;
    const el = elDeg[hour] ?? Number.NaN;
    if (!Number.isFinite(az) || !Number.isFinite(el)) {
      if (current.length) segments.push(current);
      current = [];
      previous = null;
      continue;
    }
    const point = { hour, offset: offsetFrom(centreDeg, az), el };
    if (previous && Math.abs(point.offset - previous.offset) > 180) {
      const shift = point.offset > previous.offset ? -360 : 360;
      current.push({ ...point, offset: point.offset + shift });
      segments.push(current);
      current = [{ ...previous, offset: previous.offset - shift }];
    }
    current.push(point);
    previous = point;
  }
  if (current.length) segments.push(current);
  return segments;
}

/**
 * The average direction of a body over hours `[from, to)`: the direction of the mean of its
 * unit compass vectors, so 359° and 1° average to 0°, not 180°. Null when no hour has a value.
 */
export function meanAzimuth(azDeg: ArrayLike<number>, from: number, to: number): number | null {
  let east = 0;
  let north = 0;
  let count = 0;
  const end = Math.min(to, azDeg.length);
  for (let hour = Math.max(0, from); hour < end; hour++) {
    const az = azDeg[hour] ?? Number.NaN;
    if (!Number.isFinite(az)) continue;
    const r = (az * Math.PI) / 180;
    east += Math.sin(r);
    north += Math.cos(r);
    count++;
  }
  if (count === 0 || (Math.abs(east) < 1e-12 && Math.abs(north) < 1e-12)) return null;
  return wrapAzimuth((Math.atan2(east, north) * 180) / Math.PI);
}

/** The hours of the daily ticks: the landing hour and every 24 h after it, inside `[from, to)`. */
export function dayTickHours(from: number, to: number): number[] {
  const hours: number[] = [];
  for (let hour = from; hour < to; hour += 24) hours.push(hour);
  return hours;
}

// ── The vertical range ───────────────────────────────────────────────────────

function extent(values: ArrayLike<number>, from: number, to: number, pad: number, into: { lo: number; hi: number }) {
  const end = Math.min(to, values.length);
  for (let i = Math.max(0, from); i < end; i++) {
    const v = values[i] ?? Number.NaN;
    if (!Number.isFinite(v)) continue;
    if (v - pad < into.lo) into.lo = v - pad;
    if (v + pad > into.hi) into.hi = v + pad;
  }
}

/** A step for whole-number range ends and the elevation labels. */
export function elevationStep(span: number): number {
  if (span <= 6) return 1;
  if (span <= 14) return 2;
  if (span <= 30) return 5;
  if (span <= 70) return 10;
  return 30;
}

/**
 * The vertical range, chosen from the skyline and the two paths over the window (each
 * padded by its disc's radius), always with 0° in it, plus a margin, rounded out to the
 * label step. Near the pole this is a few degrees; where the Sun climbs high it grows.
 */
export function autoRange(input: {
  skylineEl: ArrayLike<number> | null;
  sunEl: ArrayLike<number> | null;
  earthEl: ArrayLike<number> | null;
  from: number;
  to: number;
  sunRadiusDeg: number;
  earthRadiusDeg: number;
}): ElevationRange {
  const box = { lo: 0, hi: 0 };
  if (input.skylineEl) extent(input.skylineEl, 0, input.skylineEl.length, 0, box);
  if (input.sunEl) extent(input.sunEl, input.from, input.to, input.sunRadiusDeg, box);
  if (input.earthEl) extent(input.earthEl, input.from, input.to, input.earthRadiusDeg, box);
  if (box.hi - box.lo < 2) {
    box.lo -= 1;
    box.hi += 1;
  }
  const margin = Math.max(0.5, 0.12 * (box.hi - box.lo));
  const lo = box.lo - margin;
  const hi = box.hi + margin;
  const step = elevationStep(hi - lo);
  return { lo: Math.max(-90, Math.floor(lo / step) * step), hi: Math.min(90, Math.ceil(hi / step) * step) };
}

/** The range after a scroll zoom of `factor` (above 1 zooms out) about `anchorDeg`, kept between 1° and 180°. */
export function zoomRange(range: ElevationRange, factor: number, anchorDeg: number): ElevationRange {
  const span = range.hi - range.lo;
  const next = Math.min(180, Math.max(1, span * factor));
  const t = span > 0 ? (anchorDeg - range.lo) / span : 0.5;
  let lo = anchorDeg - t * next;
  let hi = lo + next;
  if (lo < -90) {
    hi += -90 - lo;
    lo = -90;
  }
  if (hi > 90) {
    lo -= hi - 90;
    hi = 90;
  }
  return { lo: Math.max(-90, lo), hi: Math.min(90, hi) };
}

/** The elevation labels: every step inside the range. */
export function elevationTicks(range: ElevationRange): number[] {
  const step = elevationStep(range.hi - range.lo);
  const ticks: number[] = [];
  for (let e = Math.ceil(range.lo / step) * step; e <= range.hi + 1e-9; e += step) ticks.push(Math.round(e * 1000) / 1000);
  return ticks;
}

// ── Discs ────────────────────────────────────────────────────────────────────

export type DiscShape = { cx: number; cy: number; rx: number; ry: number };

/** The thinnest a disc is drawn, so a Sun stretched twelve times is still seen. */
export const MIN_DISC_RX = 1.5;

/**
 * A disc of angular radius `radiusDeg` centred at a stored azimuth and elevation, as the
 * chart draws it: an ellipse, because the two axes have different scales. Across, the disc
 * spans `radius / cos(elevation)` of azimuth, as in docs/science.md §6.
 */
export function discShape(scales: ChartScales, azDeg: number, elDeg: number, radiusDeg: number): DiscShape {
  const cosEl = Math.max(0.05, Math.cos((elDeg * Math.PI) / 180));
  return {
    cx: xOfAzimuth(scales, azDeg),
    cy: scales.y(elDeg),
    rx: Math.max(MIN_DISC_RX, (radiusDeg / cosEl) * scales.pxPerDeg),
    ry: radiusDeg * scales.pyPerDeg,
  };
}

// ── The antenna mask ─────────────────────────────────────────────────────────

/** How far the antenna-mask line reaches past Earth's path on each side. */
export const MASK_REACH_DEG = 12;

/**
 * The antenna mask drawn above the skyline around Earth's path: for each skyline vertex
 * within `MASK_REACH_DEG` of the path's azimuth span, the stored skyline plus the profile's
 * mask. Null when there is no path.
 */
export function maskVertices(vertices: readonly SkylineVertex[], earthOffsets: readonly number[], maskDeg: number): SkylineVertex[] | null {
  if (earthOffsets.length === 0) return null;
  const lo = Math.min(...earthOffsets) - MASK_REACH_DEG;
  const hi = Math.max(...earthOffsets) + MASK_REACH_DEG;
  const out = vertices.filter((v) => v.offset >= lo && v.offset <= hi).map((v) => ({ ...v, el: v.el + maskDeg }));
  return out.length > 1 ? out : null;
}

// ── Compass ──────────────────────────────────────────────────────────────────

const COMPASS: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };

export type CompassTick = { azDeg: number; x: number; size: "major" | "mid" | "minor"; label: string | null };

/** Ticks every 10°; N, E, S and W always named, the half-winds and degrees when there is room. */
export function compassTicks(scales: ChartScales): CompassTick[] {
  const roomy = scales.pxPerDeg * 45 >= 56;
  const degrees = scales.pxPerDeg * 30 >= 40;
  const ticks: CompassTick[] = [];
  for (let az = 0; az < 360; az += 10) {
    const x = xOfAzimuth(scales, az);
    if (x < scales.frame.left - 0.5 || x > scales.frame.right + 0.5) continue;
    const cardinal = az % 90 === 0;
    const half = az % 45 === 0 && !cardinal;
    const thirty = az % 30 === 0;
    let label: string | null = null;
    if (cardinal) label = COMPASS[az] ?? null;
    else if (half && roomy) label = COMPASS[az] ?? null;
    else if (thirty && degrees && !half) label = `${az}°`;
    ticks.push({ azDeg: az, x, size: cardinal ? "major" : thirty || half ? "mid" : "minor", label });
  }
  return ticks;
}
