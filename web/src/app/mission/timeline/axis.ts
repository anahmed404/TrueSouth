/**
 * The timeline's geometry: which hours it shows, where an hour sits in pixels, where the
 * bands are filled, and where the longest stretches are. Display only. Lit and link come
 * from `useHourFlags` (docs/science.md §9); nothing here decides whether an hour is lit.
 *
 * Hours are global indices on the time grid. A range is inclusive at both ends; a run or a
 * segment is half-open, `[from, to)`. Hour `h` is drawn as the slot from `x(h)` to
 * `x(h + 1)`; the scrubber stands at `x(h)`, the start of its hour, which is the moment
 * the series sample describes.
 */

import { windowLength } from "../../../lib/scoring";
import { TIMELINE_CONTEXT_HOURS } from "../../../state/scenario";

export const HOUR_MS = 3_600_000;

/** The hours the timeline shows for one mission window. */
export type TimelineRange = {
  /** First and last hour shown, inclusive. Three days either side, cut at the grid's edges. */
  start: number;
  end: number;
  /** The landing hour, and the hour just after the mission window. */
  landing: number;
  windowEnd: number;
  /** Hours in the mission window. */
  hours: number;
  /** False when the window runs past the end of the time grid: no result, not a NO-GO. */
  fits: boolean;
};

export function timelineRange(gridCount: number, landingHour: number, durationDays: number): TimelineRange {
  const hours = windowLength(durationDays);
  const windowEnd = landingHour + hours;
  const last = gridCount - 1;
  return {
    start: Math.max(0, landingHour - TIMELINE_CONTEXT_HOURS),
    end: Math.max(Math.min(last, windowEnd - 1 + TIMELINE_CONTEXT_HOURS), Math.min(landingHour, last)),
    landing: landingHour,
    windowEnd,
    hours,
    fits: windowEnd <= gridCount,
  };
}

/** Number of hour slots a range draws. */
export function slotCount(range: Pick<TimelineRange, "start" | "end">): number {
  return range.end - range.start + 1;
}

/** Maps hours to pixels across a plot `width` pixels wide that starts at `x0`. */
export type HourScale = {
  start: number;
  slots: number;
  x0: number;
  width: number;
};

export function hourScale(range: Pick<TimelineRange, "start" | "end">, x0: number, width: number): HourScale {
  return { start: range.start, slots: slotCount(range), x0, width: Math.max(0, width) };
}

/** Left edge of hour `hour`'s slot. `hourToX(scale, end + 1)` is the plot's right edge. */
export function hourToX(scale: HourScale, hour: number): number {
  if (scale.slots <= 0) return scale.x0;
  return scale.x0 + ((hour - scale.start) * scale.width) / scale.slots;
}

/**
 * The hour whose start is nearest to pixel `x`, clamped to the range. The inverse of
 * `hourToX` for every hour in the range.
 */
export function xToHour(scale: HourScale, x: number): number {
  if (scale.slots <= 0 || scale.width <= 0) return scale.start;
  const raw = Math.round(((x - scale.x0) * scale.slots) / scale.width);
  return scale.start + Math.min(scale.slots - 1, Math.max(0, raw));
}

/** One filled stretch of a band: hours `[from, to)` at a height from 0 to 1. */
export type Segment = {
  from: number;
  to: number;
  /** Inside the mission window (full strength) or in the faint context days. */
  inWindow: boolean;
  /** Band height, 0–1. The Earth band is always 1. */
  level: number;
};

type WindowEdges = Pick<TimelineRange, "start" | "end" | "landing" | "windowEnd">;

function inWindow(hour: number, edges: WindowEdges): boolean {
  return hour >= edges.landing && hour < edges.windowEnd;
}

/**
 * Filled stretches of a band over the range. An hour is filled when `flags[hour]` is 1.
 * `level(hour)` gives its height (the Sun band follows `sun_frac`); neighbouring hours
 * with the same height and the same side of a window edge merge into one segment.
 */
export function bandSegments(
  flags: ArrayLike<number>,
  edges: WindowEdges,
  level: (hour: number) => number = () => 1,
): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;
  const last = Math.min(edges.end, flags.length - 1);
  for (let hour = Math.max(0, edges.start); hour <= last; hour++) {
    if (flags[hour] !== 1) {
      current = null;
      continue;
    }
    const height = quantise(level(hour));
    const side = inWindow(hour, edges);
    if (current && current.to === hour && current.inWindow === side && current.level === height) {
      current.to = hour + 1;
    } else {
      current = { from: hour, to: hour + 1, inWindow: side, level: height };
      segments.push(current);
    }
  }
  return segments;
}

/** Heights in steps of 1/100, so a band of near-equal heights draws as few segments. */
function quantise(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

/** A run of hours `[from, to)`. */
export type Run = { from: number; to: number };

/**
 * The longest unbroken run of hours where `flags` is 0, inside `[from, to)`. The first such
 * run wins a tie, so it matches `longest_dark_h` and `longest_blackout_h` in docs/science.md
 * §9 when `[from, to)` is the mission window. Null when there is no such hour.
 */
export function longestOffRun(flags: ArrayLike<number>, from: number, to: number): Run | null {
  let best: Run | null = null;
  let runStart = -1;
  const stop = Math.min(to, flags.length);
  for (let hour = Math.max(0, from); hour <= stop; hour++) {
    const off = hour < stop && flags[hour] !== 1;
    if (off && runStart < 0) runStart = hour;
    if (!off && runStart >= 0) {
      if (!best || hour - runStart > best.to - best.from) best = { from: runStart, to: hour };
      runStart = -1;
    }
  }
  return best;
}

/** The run of equal flags around `hour`, cut to `[from, to)`. */
export function runAround(flags: ArrayLike<number>, hour: number, from = 0, to = flags.length): Run {
  const value = flags[hour];
  let start = hour;
  let stop = hour + 1;
  const low = Math.max(0, from);
  const high = Math.min(flags.length, to);
  while (start > low && flags[start - 1] === value) start--;
  while (stop < high && flags[stop] === value) stop++;
  return { from: start, to: stop };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The UTC parts of a grid hour, read from its ISO string (no local-time methods). */
export function utcParts(gridStartMs: number, hour: number): { year: number; month: number; day: number; hh: string; mm: string } {
  const iso = new Date(gridStartMs + hour * HOUR_MS).toISOString();
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
    hh: iso.slice(11, 13),
    mm: iso.slice(14, 16),
  };
}

/** "03 Mar". */
export function shortDate(gridStartMs: number, hour: number): string {
  const p = utcParts(gridStartMs, hour);
  return `${String(p.day).padStart(2, "0")} ${MONTHS[p.month - 1] ?? ""}`;
}

/** "03 Mar 15:00 UTC". */
export function shortStamp(gridStartMs: number, hour: number): string {
  const p = utcParts(gridStartMs, hour);
  return `${shortDate(gridStartMs, hour)} ${p.hh}:${p.mm} UTC`;
}

/** "01 Mar 2028 00:00 → 11 Mar 00:00 UTC": the mission window from landing to its end. */
export function windowText(range: Pick<TimelineRange, "landing" | "windowEnd">, gridStartMs: number): string {
  const a = utcParts(gridStartMs, range.landing);
  const b = utcParts(gridStartMs, range.windowEnd);
  const year = a.year === b.year ? "" : ` ${b.year}`;
  return `${shortDate(gridStartMs, range.landing)} ${a.year} ${a.hh}:${a.mm} → ${shortDate(gridStartMs, range.windowEnd)}${year} ${b.hh}:${b.mm} UTC`;
}

/** "03 March 2028 15:00 UTC", for screen readers. */
export function longStamp(gridStartMs: number, hour: number): string {
  const p = utcParts(gridStartMs, hour);
  return `${String(p.day).padStart(2, "0")} ${MONTHS_LONG[p.month - 1] ?? ""} ${p.year} ${p.hh}:${p.mm} UTC`;
}

const MINUS = "−";

/**
 * The day label of an hour relative to the mission window: "Day 3" inside it, "−2 d"
 * before landing, "+1 d" after the window. Days count from the landing hour.
 */
export function dayLabel(range: Pick<TimelineRange, "landing" | "windowEnd">, hour: number): string {
  const day = Math.floor((hour - range.landing) / 24);
  if (hour < range.landing) return `${MINUS}${-day} d`;
  if (hour < range.windowEnd) return `Day ${day + 1}`;
  const after = Math.floor((hour - range.windowEnd) / 24) + 1;
  return `+${after} d`;
}

/** One day tick: its hour, label and UTC date, and whether its day is in the window. */
export type DayTick = {
  hour: number;
  label: string;
  date: string;
  inWindow: boolean;
  /** Whether this tick's label is drawn (labels thin out on a narrow or long timeline). */
  labelled: boolean;
};

const LABEL_STEPS = [1, 2, 3, 5, 7, 10, 14, 20, 30, 50, 100];

/** Days between labels so that labels stay at least `minPx` apart. */
export function labelStep(pxPerDay: number, minPx = 44): number {
  for (const step of LABEL_STEPS) if (step * pxPerDay >= minPx) return step;
  return LABEL_STEPS[LABEL_STEPS.length - 1] ?? 100;
}

/**
 * Day ticks across the range, every 24 hours from the landing hour (so the window's days
 * line up with "Day 1", "Day 2"…), from the first such hour at or after the range's start.
 * A window that is not a whole number of days ends between two ticks; the timeline marks
 * that end with its own line, not with a tick.
 */
export function dayTicks(range: TimelineRange, gridStartMs: number, pxPerHour: number): DayTick[] {
  const step = labelStep(pxPerHour * 24);
  const first = range.landing - Math.floor((range.landing - range.start) / 24) * 24;
  const ticks: DayTick[] = [];
  for (let hour = first; hour <= range.end; hour += 24) {
    const day = Math.round((hour - range.landing) / 24);
    ticks.push({
      hour,
      label: dayLabel(range, hour),
      date: shortDate(gridStartMs, hour),
      inWindow: hour >= range.landing && hour < range.windowEnd,
      labelled: ((day % step) + step) % step === 0,
    });
  }
  return ticks;
}

/** What the scrubber's screen-reader text needs about the current hour. */
export type ValueTextInput = {
  range: Pick<TimelineRange, "landing" | "windowEnd">;
  hour: number;
  gridStartMs: number;
  lit: boolean | null;
  link: boolean | null;
  relay: boolean;
};

/**
 * The scrubber's `aria-valuetext`: "Day 3, 03 March 2028 15:00 UTC, lit, link".
 * Before landing: "2 days before landing, …"; after the window: "1 day after the window, …".
 */
export function sliderValueText({ range, hour, gridStartMs, lit, link, relay }: ValueTextInput): string {
  const parts: string[] = [];
  if (hour < range.landing) {
    const days = Math.ceil((range.landing - hour) / 24);
    parts.push(`${days} ${days === 1 ? "day" : "days"} before landing`);
  } else if (hour < range.windowEnd) {
    parts.push(`Day ${Math.floor((hour - range.landing) / 24) + 1}`);
  } else {
    const days = Math.floor((hour - range.windowEnd) / 24) + 1;
    parts.push(`${days} ${days === 1 ? "day" : "days"} after the window`);
  }
  parts.push(longStamp(gridStartMs, hour));
  if (lit !== null) parts.push(lit ? "lit" : "dark");
  if (link !== null) parts.push(link ? (relay ? "link by relay" : "link") : "blackout");
  return parts.join(", ");
}

/** The pill on the scrubber: "Day 3 · 03 Mar 15:00 UTC". */
export function pillText(range: Pick<TimelineRange, "landing" | "windowEnd">, hour: number, gridStartMs: number): string {
  return `${dayLabel(range, hour)} · ${shortStamp(gridStartMs, hour)}`;
}
