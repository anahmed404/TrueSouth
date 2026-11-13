/**
 * What the timeline draws, as plain data: which flags feed which band, the rectangle of
 * every filled segment and of every stretch outline, in hours and in pixels, and the
 * clearance chart's text for screen readers. The components only turn these into SVG, so
 * the tests can check the drawing against `hourFlags` and `evaluate`.
 */

import type { MissionProfile } from "../../../contracts/generated";
import type { Evaluation, HourFlags } from "../../../lib/scoring";
import { formatNumber } from "../../../components/format";
import { formatLimit, ruleFields, settingsProvenance, valueAndLimit, type SettingsProvenance } from "../rules";
import { bandSegments, hourToX, longestOffRun, type HourScale, type Run, type Segment, type TimelineRange } from "./axis";

/** Plot geometry in CSS pixels. */
export const PLOT = {
  gutter: 48,
  gutterNarrow: 40,
  right: 4,
  dayRow: 20,
  bandH: 26,
  bandGap: 6,
  dateRow: 18,
  chartH: 96,
  chartGap: 12,
  /** How far a stretch outline stands out from its band. */
  outlinePad: 2,
  outlineRise: 3,
} as const;

/** Narrower than this, the plot uses the narrow gutter and the labels flow. */
export const NARROW_PLOT = 520;

/** Clear space kept between the scrubber's pill and an axis label, in px. */
export const PILL_CLEARANCE = 4;

/**
 * Which axis labels the scrubber's pill would cover: any label whose box comes within
 * `PILL_CLEARANCE` of the pill. Those are hidden while the pill is there, so no label shows
 * half under it; the pill itself names the day under the scrubber.
 */
export function coveredLabels(
  labels: readonly { left: number; right: number }[],
  pill: { left: number; right: number },
  clearance = PILL_CLEARANCE,
): boolean[] {
  return labels.map((label) => label.right > pill.left - clearance && label.left < pill.right + clearance);
}

/** Vertical positions of the plot's rows. */
export type PlotLayout = {
  chartTop: number;
  bandsTop: number;
  sunY: number;
  earthY: number;
  /** The plot's full height. */
  height: number;
};

export function plotLayout(chartOpen: boolean): PlotLayout {
  const bandsTop = chartOpen ? PLOT.chartH + PLOT.chartGap : 0;
  const sunY = bandsTop + PLOT.dayRow;
  const earthY = sunY + PLOT.bandH + PLOT.bandGap;
  return { chartTop: 0, bandsTop, sunY, earthY, height: earthY + PLOT.bandH + PLOT.dateRow };
}

/**
 * The two bands: the Sun band is filled on lit hours at the height of `sun_frac`; the
 * Earth band is filled on link hours at full height (docs/features/site-detail.md).
 */
export function bandLayers(
  flags: HourFlags,
  sunFrac: ArrayLike<number>,
  range: Pick<TimelineRange, "start" | "end" | "landing" | "windowEnd">,
): { sun: Segment[]; earth: Segment[] } {
  return {
    sun: bandSegments(flags.lit, range, (hour) => sunFrac[hour] ?? 0),
    earth: bandSegments(flags.link, range),
  };
}

export type Rect = { x: number; y: number; width: number; height: number };

/** The rectangle of each segment in a band whose top is `y`, filled from the bottom. */
export function segmentRects(segments: readonly Segment[], scale: HourScale, y: number, h: number): (Rect & { inWindow: boolean })[] {
  return segments.map((segment) => {
    const xa = hourToX(scale, segment.from);
    const xb = hourToX(scale, segment.to);
    const filled = h * segment.level;
    return { x: xa, y: y + h - filled, width: xb - xa, height: filled, inWindow: segment.inWindow };
  });
}

/** One SVG path for the rectangles on one side of the window's edges. */
export function rectsPath(rects: readonly (Rect & { inWindow: boolean })[], inWindow: boolean): string {
  let d = "";
  for (const r of rects) {
    if (r.inWindow !== inWindow) continue;
    d += `M${r.x.toFixed(2)} ${r.y.toFixed(2)}H${(r.x + r.width).toFixed(2)}V${(r.y + r.height).toFixed(2)}H${r.x.toFixed(2)}Z`;
  }
  return d;
}

/** The longest stretches, located from the flags, numbered from the metrics. */
export type Stretch = {
  kind: "dark" | "blackout";
  /** Where the stretch is, `[from, to)` hours; null when there is none to outline. */
  run: Run | null;
  hours: number;
  broken: boolean;
  label: string;
  /** "limit 6 h", or null when there is no limit to show (a relay). */
  limit: string | null;
  fields: SettingsProvenance;
};

/**
 * The longest dark stretch and the longest blackout of the mission window (docs/science.md
 * §9). The number and the verdict come from the evaluation; the position is the first
 * longest run of the matching flag, which is the run the metric measured.
 */
export function stretches(range: TimelineRange, flags: HourFlags, evaluation: Evaluation | null, profile: MissionProfile): Stretch[] {
  if (!evaluation) return [];
  const out: Stretch[] = [];
  const dark = longestOffRun(flags.lit, range.landing, range.windowEnd);
  const darkPrinted = valueAndLimit(evaluation.metrics.longestDarkH, profile.max_dark_h, "h", 0);
  out.push({
    kind: "dark",
    run: dark,
    hours: evaluation.metrics.longestDarkH,
    broken: evaluation.vetoes.darkness.triggered,
    label: dark ? `Longest dark ${darkPrinted.value}` : "No dark hours",
    limit: `limit ${darkPrinted.limit}`,
    fields: settingsProvenance(profile, ruleFields(profile, "darkness")),
  });
  if (profile.relay_available) {
    out.push({
      kind: "blackout",
      run: null,
      hours: 0,
      broken: false,
      label: "No blackouts with a relay",
      limit: null,
      fields: settingsProvenance(profile, ruleFields(profile, "relay")),
    });
  } else {
    const blackout = longestOffRun(flags.link, range.landing, range.windowEnd);
    const printed = valueAndLimit(evaluation.metrics.longestBlackoutH, profile.max_blackout_h, "h", 0);
    out.push({
      kind: "blackout",
      run: blackout,
      hours: evaluation.metrics.longestBlackoutH,
      broken: evaluation.vetoes.blackout.triggered,
      label: blackout ? `Longest blackout ${printed.value}` : "No blackout",
      limit: `limit ${printed.limit}`,
      fields: settingsProvenance(profile, ruleFields(profile, "blackout")),
    });
  }
  return out;
}

/**
 * The outline around a stretch: the dark stretch on the Sun band, the blackout on the
 * Earth band, from the start of its first hour to the end of its last, standing out a
 * little on every side. Null when there is no stretch.
 */
export function stretchOutline(stretch: Pick<Stretch, "kind" | "run">, scale: HourScale, layout: PlotLayout): Rect | null {
  if (!stretch.run) return null;
  const xa = hourToX(scale, stretch.run.from) - PLOT.outlinePad;
  const xb = hourToX(scale, stretch.run.to) + PLOT.outlinePad;
  const y = (stretch.kind === "dark" ? layout.sunY : layout.earthY) - PLOT.outlineRise;
  return { x: xa, y, width: Math.max(2 * PLOT.outlinePad, xb - xa), height: PLOT.bandH + 2 * PLOT.outlineRise };
}

type ClearanceColumns = { sun_clear: ArrayLike<number>; earth_clear: ArrayLike<number> };

function summarise(values: ArrayLike<number>, from: number, to: number, line: number) {
  let lo = Infinity;
  let hi = -Infinity;
  let above = 0;
  let hours = 0;
  for (let h = from; h < to; h++) {
    const v = values[h];
    if (v === undefined || !Number.isFinite(v)) continue;
    hours++;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
    if (v >= line) above++;
  }
  return { lo, hi, above, hours };
}

/**
 * The clearance chart in words, for screen readers: over the mission window, the range of
 * each curve and how many hours each is on or above its line (0° for the Sun, the antenna
 * mask for Earth).
 */
export function clearanceSummary(series: ClearanceColumns, range: Pick<TimelineRange, "landing" | "windowEnd">, profile: Pick<MissionProfile, "relay_available" | "antenna_mask_deg">): string {
  const sun = summarise(series.sun_clear, range.landing, range.windowEnd, 0);
  const mask = profile.relay_available ? 0 : profile.antenna_mask_deg;
  const earth = summarise(series.earth_clear, range.landing, range.windowEnd, mask);
  if (sun.hours === 0) return "Clearance chart: no data in the mission window.";
  const deg = (v: number) => `${formatNumber(v, 2)}°`;
  const sunText = `Sun clearance runs from ${deg(sun.lo)} to ${deg(sun.hi)} over the mission window, and is at or above 0° for ${sun.above} of ${sun.hours} hours.`;
  const line = profile.relay_available ? "0°" : `the ${formatLimit(mask, "°")} antenna mask`;
  const earthText = `Earth clearance runs from ${deg(earth.lo)} to ${deg(earth.hi)}, and is at or above ${line} for ${earth.above} of ${earth.hours} hours.`;
  return `Clearance chart. ${sunText} ${earthText}`;
}
