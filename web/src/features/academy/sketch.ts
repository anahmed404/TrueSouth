import { skylineBinCentreDeg } from "../../lib/geo";
import { clockwiseWidthDeg, skylineGapDeg, wrapAzimuth } from "./skyline-score";
import type { SketchPoint } from "./types";

/**
 * The draw-skyline step's sketch, kept pure for tests. A sketch is one height per column
 * across the step's azimuth window, so a line drawn with the pointer can never double back:
 * moving left over a column redraws it. The keyboard path is a row of handles that makes the
 * same kind of line. The real skyline is read from `skyline.bin`; nothing here computes one.
 *
 * Azimuths inside this file are offsets from the window's start, in degrees, from 0 to the
 * window's width, so a window that crosses north needs no special case.
 */

/** One height per column, in degrees, or null where nothing is drawn yet. */
export type Sketch = readonly (number | null)[];

/** Columns per degree of azimuth. A 60° window has 61 columns, one a degree. */
export const COLUMNS_PER_DEG = 1;

/** The keyboard handles across the window. */
export const HANDLE_COUNT = 9;

/** How far one arrow press moves a handle, and with Shift. */
export const HANDLE_STEP_DEG = 0.1;
export const HANDLE_STEP_SHIFT_DEG = 0.5;

export function columnCount(widthDeg: number): number {
  return Math.max(2, Math.round(widthDeg * COLUMNS_PER_DEG) + 1);
}

export function emptySketch(columns: number): Sketch {
  return Array.from({ length: columns }, () => null);
}

/** The offset of a column, in degrees from the window's start. */
export function columnOffsetDeg(column: number, columns: number, widthDeg: number): number {
  return columns <= 1 ? 0 : (column * widthDeg) / (columns - 1);
}

/** The nearest column to an offset, clamped to the window. */
export function columnAt(offsetDeg: number, columns: number, widthDeg: number): number {
  if (!(widthDeg > 0)) return 0;
  return Math.min(columns - 1, Math.max(0, Math.round((offsetDeg / widthDeg) * (columns - 1))));
}

/**
 * The sketch after the pointer moves from `from` to `to` (columns and heights): every
 * column between them takes the straight line's height, so a fast stroke leaves no gaps,
 * and a column already drawn is overwritten. `from` is null at the start of a stroke.
 */
export function strokeTo(
  sketch: Sketch,
  from: { column: number; elDeg: number } | null,
  to: { column: number; elDeg: number },
): Sketch {
  const next = [...sketch];
  const start = from ?? to;
  const lo = Math.min(start.column, to.column);
  const hi = Math.max(start.column, to.column);
  for (let column = lo; column <= hi; column += 1) {
    if (column < 0 || column >= next.length) continue;
    const span = to.column - start.column;
    const t = span === 0 ? 1 : (column - start.column) / span;
    next[column] = start.elDeg + t * (to.elDeg - start.elDeg);
  }
  return next;
}

/** The columns that carry the handles, spread evenly from the first to the last. */
export function handleColumns(columns: number, count = HANDLE_COUNT): number[] {
  return Array.from({ length: count }, (_, index) => Math.round((index * (columns - 1)) / (count - 1)));
}

/** The sketch's height at a column: drawn, or straight between the nearest drawn columns, or flat past the ends. */
export function heightAt(sketch: Sketch, column: number): number | null {
  const own = sketch[column];
  if (own !== null && own !== undefined) return own;
  let left = column - 1;
  while (left >= 0 && (sketch[left] === null || sketch[left] === undefined)) left -= 1;
  let right = column + 1;
  while (right < sketch.length && (sketch[right] === null || sketch[right] === undefined)) right += 1;
  const l = left >= 0 ? sketch[left] : null;
  const r = right < sketch.length ? sketch[right] : null;
  if (l !== null && l !== undefined && r !== null && r !== undefined) return l + ((column - left) / (right - left)) * (r - l);
  return l ?? r ?? null;
}

/** The handles' heights for a sketch, or `fallback` where nothing is drawn. */
export function handlesFrom(sketch: Sketch, fallback: number, count = HANDLE_COUNT): number[] {
  return handleColumns(sketch.length, count).map((column) => heightAt(sketch, column) ?? fallback);
}

/** The line through the handles: one height per column, straight between handles. */
export function sketchFromHandles(heights: readonly number[], columns: number): Sketch {
  const at = handleColumns(columns, heights.length);
  const out: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    let k = 0;
    while (k < at.length - 2 && column > (at[k + 1] ?? 0)) k += 1;
    const c0 = at[k] ?? 0;
    const c1 = at[k + 1] ?? c0;
    const h0 = heights[k] ?? 0;
    const h1 = heights[k + 1] ?? h0;
    out.push(c1 === c0 ? h0 : h0 + ((column - c0) / (c1 - c0)) * (h1 - h0));
  }
  return out;
}

/** Moves one handle and returns the new handle heights, kept inside the vertical range. */
export function nudgeHandle(
  heights: readonly number[],
  index: number,
  key: string,
  shift: boolean,
  range: { lo: number; hi: number },
): number[] | null {
  const step = shift ? HANDLE_STEP_SHIFT_DEG : HANDLE_STEP_DEG;
  const current = heights[index];
  if (current === undefined) return null;
  let value: number;
  if (key === "ArrowUp") value = current + step;
  else if (key === "ArrowDown") value = current - step;
  else return null;
  const next = [...heights];
  next[index] = Math.round(Math.min(range.hi, Math.max(range.lo, value)) * 100) / 100;
  return next;
}

/** True when the sketch has a line to score: at least two drawn columns. */
export function hasLine(sketch: Sketch): boolean {
  return sketch.filter((height) => height !== null).length >= 2;
}

/** The drawn columns as points, offsets in degrees from the window's start. */
export function sketchOffsets(sketch: Sketch, widthDeg: number): SketchPoint[] {
  const points: SketchPoint[] = [];
  sketch.forEach((elDeg, column) => {
    if (elDeg !== null) points.push({ azDeg: columnOffsetDeg(column, sketch.length, widthDeg), elDeg });
  });
  return points;
}

/** The same points with true azimuths, wrapped into [0, 360), for the submission. */
export function sketchAzimuths(sketch: Sketch, fromDeg: number, widthDeg: number): SketchPoint[] {
  return sketchOffsets(sketch, widthDeg).map((point) => ({ azDeg: wrapAzimuth(fromDeg + point.azDeg), elDeg: point.elDeg }));
}

/**
 * The stored skyline's bins inside the window, as offsets from its start, in order. Read
 * straight from `skyline.bin`'s `el_deg`.
 */
export function skylineInWindow(elDeg: ArrayLike<number>, fromDeg: number, toDeg: number): SketchPoint[] {
  const bins = elDeg.length;
  const width = clockwiseWidthDeg(fromDeg, toDeg);
  const points: SketchPoint[] = [];
  for (let bin = 0; bin < bins; bin += 1) {
    const offset = clockwiseWidthDeg(fromDeg, skylineBinCentreDeg(bin, bins));
    const value = elDeg[bin];
    if (offset <= width && value !== undefined && Number.isFinite(value)) points.push({ azDeg: offset, elDeg: value });
  }
  return points.sort((a, b) => a.azDeg - b.azDeg);
}

/** The sketch's gap to the real skyline, in degrees, by `skylineGapDeg` (docs/academy/overview.md). */
export function sketchGapDeg(sketch: Sketch, real: readonly SketchPoint[], widthDeg: number): number {
  if (!hasLine(sketch) || real.length === 0) return Number.NaN;
  return skylineGapDeg(sketchOffsets(sketch, widthDeg), real, 0, widthDeg);
}
