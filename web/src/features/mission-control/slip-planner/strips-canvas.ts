import { DAY_CAUTION, DAY_GO, DAY_NOGO } from "../../../lib/scoring";
import { DAY_PENDING, markRect } from "./model";

/**
 * The landing-date panel's strips, drawn on one Canvas (slip-planner.md, "How it is
 * computed"): one row per strip, one mark per landing day, status by height as well as
 * colour. The slider, the band, the "was" line and the reading point are DOM over it, so
 * moving the landing date never draws the canvas again unless the visible range moves.
 */

export type StripColours = { plot: string; go: string; caution: string; nogo: string; none: string; pending: string };

export type StripFrame = {
  /** Each row's status codes by day; null for a row with nothing worked out yet (pending). */
  rows: readonly (ArrayLike<number> | null)[];
  start: number;
  span: number;
  /** CSS pixels. */
  width: number;
  rowHeight: number;
  gap: number;
  dpr: number;
  colours: StripColours;
};

/** The part of a canvas context the strips use, so tests can count calls. */
export type StripContext = Pick<CanvasRenderingContext2D, "setTransform" | "clearRect" | "fillRect" | "beginPath" | "save" | "restore" | "clip"> & {
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  globalAlpha: number;
  roundRect?: CanvasRenderingContext2D["roundRect"];
  rect: CanvasRenderingContext2D["rect"];
};

export function stripsHeight(rowCount: number, rowHeight: number, gap: number): number {
  return rowCount <= 0 ? 0 : rowCount * rowHeight + (rowCount - 1) * gap;
}

function colourOf(code: number, c: StripColours): string {
  if (code === DAY_GO) return c.go;
  if (code === DAY_CAUTION) return c.caution;
  if (code === DAY_NOGO) return c.nogo;
  if (code === DAY_PENDING) return c.pending;
  return c.none;
}

/** Draws every row: runs of one status, so six years at 0.3 px a day stay crisp and quick. */
export function drawStrips(ctx: StripContext, frame: StripFrame): void {
  const { rows, start, span, width, rowHeight: h, gap, dpr, colours } = frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, stripsHeight(rows.length, h, gap));
  if (span <= 0 || width <= 0) return;
  const px = width / span;
  rows.forEach((codes, index) => {
    const top = index * (h + gap);
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, top, width, h, Math.min(3, h / 4));
    else ctx.rect(0, top, width, h);
    ctx.clip();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colours.plot;
    ctx.fillRect(0, top, width, h);
    if (!codes) {
      ctx.fillStyle = colours.pending;
      ctx.fillRect(0, top, width, h);
      ctx.restore();
      return;
    }
    let runStart = start;
    let runCode = codes[start] ?? 0;
    const flush = (end: number) => {
      const mark = markRect(runCode, h);
      ctx.fillStyle = colourOf(runCode, colours);
      ctx.globalAlpha = runCode === DAY_NOGO ? 0.8 : 1;
      ctx.fillRect((runStart - start) * px, top + mark.y, (end - runStart) * px, mark.h);
    };
    for (let day = start + 1; day < start + span; day += 1) {
      const code = codes[day] ?? 0;
      if (code === runCode) continue;
      flush(day);
      runStart = day;
      runCode = code;
    }
    flush(start + span);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

/**
 * Draws the strips only when something they show has changed: the rows' arrays (by
 * identity), the visible range, the size or the colours. `draws` counts real draws.
 */
export class StripCanvas {
  draws = 0;
  private last: StripFrame | null = null;

  update(ctx: StripContext, frame: StripFrame): boolean {
    const l = this.last;
    const same =
      l !== null &&
      l.start === frame.start &&
      l.span === frame.span &&
      l.width === frame.width &&
      l.rowHeight === frame.rowHeight &&
      l.gap === frame.gap &&
      l.dpr === frame.dpr &&
      l.colours === frame.colours &&
      l.rows.length === frame.rows.length &&
      l.rows.every((row, i) => row === frame.rows[i]);
    if (same) return false;
    this.last = frame;
    this.draws += 1;
    drawStrips(ctx, frame);
    return true;
  }

  /** Forget the last frame, so the next update draws (after the canvas is resized). */
  reset(): void {
    this.last = null;
  }
}
