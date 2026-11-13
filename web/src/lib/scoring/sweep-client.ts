/**
 * One module worker for every slip sweep.
 *
 * The data store still reads the series on the main thread, so those buffers
 * are never transferred. The first request for a series copies the three
 * columns the sweep reads and transfers the copies. The worker keeps them,
 * up to its own cap, and later requests for that series send the profile
 * and the slope only. The client does not mirror the cap: the worker is
 * the one that drops a token, and a copy of that set would drift. When the
 * worker says the token is gone, the columns are sent once more.
 *
 * One worker is enough. After the series is resident, a profile edit is
 * compute, and eight sites one after another stay inside the sweep budget.
 * A pool would keep another copy of every series per worker.
 *
 * A landing date does not change the sweep (the planner reads one row of it),
 * so a newer request for the same site — a new profile, slope, or series —
 * supersedes the previous one. A reply for a superseded request is dropped.
 */

import type { TimeGrid } from "../../contracts/generated.ts";
import { slipSweepCacheKey } from "./cache.ts";
import type { ScoringProfile, Series, SlipSweep } from "./scoring.ts";
import { missingSeriesMessage, type SweepRequest, type SweepReply, type SweepSeries } from "./sweep-protocol.ts";

export type SweepJob = {
  siteId: string;
  series: Series;
  slopeDeg: number | null;
  profile: ScoringProfile;
  timeGrid: TimeGrid;
};

export type SweepDelivery =
  | { ok: true; sweep: SlipSweep }
  | { ok: false; error: string };

export type SweepListener = (delivery: SweepDelivery) => void;

export type SweepClient = {
  /** Subscribe to one sweep. Returns an unsubscribe. Does not deliver after stop. */
  request(job: SweepJob, listener: SweepListener): () => void;
  stop(): void;
};

type Inflight = {
  requestId: number;
  siteId: string;
  key: string;
  listeners: Set<SweepListener>;
  job: SweepJob;
  seriesToken: number | null;
  /** True once the columns have already been sent again for a missing token. */
  resent: boolean;
};

export function sweepWorkerAvailable(): boolean {
  return workerConstructor() !== undefined;
}

function workerConstructor(): typeof Worker | undefined {
  const ctor = (globalThis as { Worker?: typeof Worker }).Worker;
  return typeof ctor === "function" ? ctor : undefined;
}

let shared: SweepClient | null = null;

/** The app's one client. Created on the first sweep, replaced after `stop`. */
export function sharedSweepClient(): SweepClient {
  shared ??= createSweepClient();
  return shared;
}

export function stopSharedSweepClient(): void {
  shared?.stop();
  shared = null;
}

export function createSweepClient(): SweepClient {
  let worker: Worker | null = null;
  let generation = 0;
  let nextRequestId = 1;
  let nextToken = 1;
  const tokens = new WeakMap<object, number>();
  const sentTokens = new Set<number>();
  const byKey = new Map<string, Inflight>();
  const bySite = new Map<string, Inflight>();
  const byId = new Map<number, Inflight>();

  function seriesToken(series: Series): number | null {
    const sample = series.sun_frac;
    if (typeof sample !== "object" || sample === null) return null;
    const existing = tokens.get(sample);
    if (existing !== undefined) return existing;
    const token = nextToken;
    nextToken += 1;
    tokens.set(sample, token);
    return token;
  }

  function ensureWorker(): Worker {
    if (worker) return worker;
    const gen = generation;
    if (!workerConstructor()) throw new Error("Worker is not available");
    const opened = new Worker(new URL("./sweep.worker.ts", import.meta.url), { type: "module" });
    opened.onmessage = (event: MessageEvent<SweepReply>) => {
      if (gen !== generation) return;
      deliver(event.data);
    };
    opened.onerror = (event: ErrorEvent) => {
      if (gen !== generation) return;
      failAll(event.message || "sweep worker failed");
    };
    opened.onmessageerror = () => {
      if (gen !== generation) return;
      failAll("sweep worker could not read a message");
    };
    worker = opened;
    return opened;
  }

  function forget(inflight: Inflight): void {
    byId.delete(inflight.requestId);
    if (byKey.get(inflight.key) === inflight) byKey.delete(inflight.key);
    if (bySite.get(inflight.siteId) === inflight) bySite.delete(inflight.siteId);
  }

  function drop(inflight: Inflight): void {
    forget(inflight);
    inflight.listeners.clear();
  }

  function deliver(reply: SweepReply): void {
    if (!reply || (reply.type !== "sweep" && reply.type !== "error")) return;
    const inflight = byId.get(reply.requestId);
    if (!inflight) return;
    if (
      reply.type === "error" &&
      inflight.seriesToken !== null &&
      reply.message === missingSeriesMessage(inflight.seriesToken)
    ) {
      sentTokens.delete(inflight.seriesToken);
      if (!inflight.resent) {
        const listeners = inflight.listeners;
        const job = inflight.job;
        forget(inflight);
        const error = send(job, listeners, true);
        if (error) {
          for (const listener of [...listeners]) listener({ ok: false, error });
        }
        return;
      }
    }
    forget(inflight);
    const generationAtDelivery = generation;
    const listeners = [...inflight.listeners];
    const delivery: SweepDelivery =
      reply.type === "error" ? { ok: false, error: reply.message } : { ok: true, sweep: reply.sweep };
    for (const listener of listeners) {
      if (generation !== generationAtDelivery) return;
      listener(delivery);
    }
  }

  function failAll(message: string): void {
    const listeners = [...byId.values()].flatMap((item) => [...item.listeners]);
    byKey.clear();
    bySite.clear();
    byId.clear();
    sentTokens.clear();
    generation += 1;
    const dying = worker;
    worker = null;
    dying?.terminate();
    for (const listener of listeners) listener({ ok: false, error: message });
  }

  function send(job: SweepJob, listeners: Set<SweepListener>, resent: boolean): string | null {
    const key = slipSweepCacheKey(job.siteId, job.series, job.profile, job.slopeDeg, job.timeGrid);
    const requestId = nextRequestId;
    nextRequestId += 1;
    const token = seriesToken(job.series);
    const inflight: Inflight = {
      requestId,
      siteId: job.siteId,
      key,
      listeners,
      job,
      seriesToken: token,
      resent,
    };
    byKey.set(key, inflight);
    bySite.set(job.siteId, inflight);
    byId.set(requestId, inflight);

    const includeSeries = resent || token === null || !sentTokens.has(token);
    const series = includeSeries ? copySeries(job.series) : undefined;
    const payload: SweepRequest = {
      type: "sweep",
      requestId,
      siteId: job.siteId,
      seriesToken: token ?? requestId,
      slopeDeg: job.slopeDeg,
      profile: job.profile,
      timeGrid: job.timeGrid,
      ...(series ? { series } : {}),
    };
    const transfer = series
      ? [series.sun_frac.buffer, series.sun_el.buffer, series.earth_clear.buffer]
      : [];
    try {
      ensureWorker().postMessage(payload, { transfer });
    } catch (error) {
      forget(inflight);
      return error instanceof Error ? error.message : String(error);
    }
    if (includeSeries && token !== null) sentTokens.add(token);
    return null;
  }

  function request(job: SweepJob, listener: SweepListener): () => void {
    const key = slipSweepCacheKey(job.siteId, job.series, job.profile, job.slopeDeg, job.timeGrid);
    const existing = byKey.get(key);
    if (existing) {
      existing.listeners.add(listener);
      return () => existing.listeners.delete(listener);
    }

    const previous = bySite.get(job.siteId);
    if (previous) drop(previous);

    const listeners = new Set<SweepListener>([listener]);
    const error = send(job, listeners, false);
    if (error) {
      listener({ ok: false, error });
      return () => undefined;
    }
    return () => listeners.delete(listener);
  }

  function stop(): void {
    generation += 1;
    const dying = worker;
    worker = null;
    sentTokens.clear();
    byKey.clear();
    bySite.clear();
    byId.clear();
    dying?.terminate();
  }

  return { request, stop };
}

function copySeries(series: Series): SweepSeries {
  return {
    sun_frac: copyColumn(series.sun_frac),
    sun_el: copyColumn(series.sun_el),
    earth_clear: copyColumn(series.earth_clear),
  };
}

function copyColumn(values: ArrayLike<number>): Float64Array {
  const copy = new Float64Array(values.length);
  copy.set(values);
  return copy;
}
