/**
 * Messages for the slip-sweep worker, and the handler that answers one.
 *
 * The handler is pure aside from the series map the worker keeps. Tests call
 * it directly. The worker file only forwards `postMessage` here. That map
 * holds at most `SWEEP_SERIES_LIMIT` series, least recently used: eight
 * selected sites, plus a few replaced or custom ones.
 *
 * The time grid is checked, not sampled. `slipSweep` returns every landing
 * hour; the Slip Planner reads the 00:00 UTC rows on the main thread.
 */

import type { TimeGrid } from "../../contracts/generated.ts";
import { slipSweep, type ScoringProfile, type Series, type SlipSweep } from "./scoring.ts";

/** The three series columns `slipSweep` reads. */
export type SweepSeries = {
  sun_frac: Float64Array;
  sun_el: Float64Array;
  earth_clear: Float64Array;
};

export type SweepRequest = {
  type: "sweep";
  requestId: number;
  siteId: string;
  /** Identifies series already stored in the worker. */
  seriesToken: number;
  /** Present only the first time this token is sent to the current worker. */
  series?: SweepSeries;
  slopeDeg: number | null;
  profile: ScoringProfile;
  timeGrid: TimeGrid;
};

export type SweepReply =
  | { type: "sweep"; requestId: number; sweep: SlipSweep }
  | { type: "error"; requestId: number; message: string };

/**
 * How many transferred series the worker keeps. Eight selected sites, plus
 * room for a reload or a recomputed custom site to arrive before the old
 * one is asked for again.
 */
export const SWEEP_SERIES_LIMIT = 12;

export function missingSeriesMessage(token: number): string {
  return `series ${token} is not in the worker`;
}

export function handleSweepRequest(request: SweepRequest, stored: Map<number, SweepSeries>): SweepReply {
  const requestId = request?.requestId ?? 0;
  try {
    if (!request || request.type !== "sweep") {
      return { type: "error", requestId, message: "unknown sweep request" };
    }
    if (request.series) retainSeries(stored, request.seriesToken, request.series);
    const series = recallSeries(stored, request.seriesToken);
    if (!series) {
      return {
        type: "error",
        requestId,
        message: missingSeriesMessage(request.seriesToken),
      };
    }
    assertTimeGrid(request.timeGrid, seriesLength(series));
    return {
      type: "sweep",
      requestId,
      sweep: slipSweep(series, request.profile, request.slopeDeg),
    };
  } catch (error) {
    return {
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Buffers to transfer with a sweep reply. Each buffer is listed once. */
export function sweepTransferables(sweep: SlipSweep): Transferable[] {
  const buffers = [
    sweep.sunFractionMean.buffer,
    sweep.litFraction.buffer,
    sweep.longestDarkH.buffer,
    sweep.linkFraction.buffer,
    sweep.longestBlackoutH.buffer,
    sweep.landingSunElDeg.buffer,
    sweep.landingLit.buffer,
  ];
  return [...new Set(buffers)];
}

/** Store `series` under `token` and drop the least recently used past the cap. */
function retainSeries(stored: Map<number, SweepSeries>, token: number, series: SweepSeries): void {
  stored.delete(token);
  stored.set(token, series);
  while (stored.size > SWEEP_SERIES_LIMIT) {
    const oldest = stored.keys().next().value;
    if (oldest === undefined) return;
    stored.delete(oldest);
  }
}

/** The series for `token`, or undefined. A hit becomes the most recently used. */
function recallSeries(stored: Map<number, SweepSeries>, token: number): SweepSeries | undefined {
  const series = stored.get(token);
  if (!series) return undefined;
  stored.delete(token);
  stored.set(token, series);
  return series;
}

function seriesLength(series: Series): number {
  const count = series.sun_frac.length;
  if (series.sun_el.length !== count || series.earth_clear.length !== count) {
    throw new RangeError("series columns must be equally sized vectors");
  }
  return count;
}

/**
 * Hour 0 of the product grid is 00:00 UTC, and `utcMidnightHours` relies on
 * that. Reject anything else before the sweep runs.
 */
function assertTimeGrid(grid: TimeGrid, hourCount: number): void {
  if (!Number.isInteger(grid.count) || grid.count !== hourCount) {
    throw new Error(`time grid has ${grid.count} hours but the series has ${hourCount}`);
  }
  if (grid.step_s !== 3600) {
    throw new Error("time grid step_s must be 3600");
  }
  if (!grid.start_utc.endsWith("Z")) {
    throw new Error("time grid start_utc must end in Z");
  }
  if (!grid.start_utc.endsWith("T00:00:00Z")) {
    throw new Error("time grid must start at 00:00 UTC");
  }
}
