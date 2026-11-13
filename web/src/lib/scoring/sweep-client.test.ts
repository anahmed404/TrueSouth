import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TimeGrid } from "../../contracts/generated.ts";
import type { ScoringProfile, Series, SlipSweep } from "./scoring.ts";
import { createSweepClient, type SweepJob, type SweepListener } from "./sweep-client.ts";
import type { SweepRequest } from "./sweep-protocol.ts";

type Posted = {
  requestId: number;
  siteId: string;
  seriesToken: number;
  hasSeries: boolean;
  duration: number;
  slopeDeg: number | null;
  transferredSource: boolean;
};

class FakeWorker {
  static instances: FakeWorker[] = [];
  static sourceBuffers = new Set<ArrayBufferLike>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: Posted[] = [];
  terminated = false;

  constructor(
    public url: string | URL,
    public options?: { type?: string },
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(data: SweepRequest, options?: { transfer?: Transferable[] }): void {
    const transfer = options?.transfer ?? [];
    this.posted.push({
      requestId: data.requestId,
      siteId: data.siteId,
      seriesToken: data.seriesToken,
      hasSeries: data.series !== undefined,
      duration: data.profile.duration_days,
      slopeDeg: data.slopeDeg,
      transferredSource: transfer.some((item) => FakeWorker.sourceBuffers.has(item as ArrayBuffer)),
    });
    for (const item of transfer) {
      if (item instanceof ArrayBuffer) structuredClone(item, { transfer: [item] });
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const grid: TimeGrid = { count: 4, start_utc: "2026-01-01T00:00:00Z", step_s: 3600 };

function profile(durationDays: number): ScoringProfile {
  return {
    duration_days: durationDays,
    min_sun_fraction: 0.5,
    ops_sun_el_min_deg: null,
    max_dark_h: 4,
    relay_available: false,
    antenna_mask_deg: 1,
    max_blackout_h: 4,
    max_slope_deg: 10,
    slope_ideal_deg: 5,
    landing_sun_el_min_deg: null,
    landing_sun_el_max_deg: null,
    weights: { slope: 1, power: 1, comms: 1 },
  };
}

function series(): { sun_frac: Float64Array; sun_el: Float64Array; earth_clear: Float64Array } {
  return {
    sun_frac: Float64Array.of(1, 0, 1, 1),
    sun_el: Float64Array.of(3, 3, 3, 3),
    earth_clear: Float64Array.of(2, 2, 2, 2),
  };
}

function job(siteId: string, samples: Series, durationDays: number, slopeDeg: number | null = 3): SweepJob {
  return { siteId, series: samples, slopeDeg, profile: profile(durationDays), timeGrid: grid };
}

function markerSweep(slopeDeg: number): SlipSweep {
  return {
    hourCount: 4,
    windowHours: 1,
    landingCount: 4,
    slopeDeg,
    sunFractionMean: Float64Array.of(slopeDeg),
    litFraction: Float64Array.of(0),
    longestDarkH: Int32Array.of(0),
    linkFraction: Float64Array.of(0),
    longestBlackoutH: Int32Array.of(0),
    landingSunElDeg: Float64Array.of(0),
    landingLit: Uint8Array.of(1),
  };
}

describe("sweep client", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    FakeWorker.sourceBuffers = new Set();
    (globalThis as { Worker: unknown }).Worker = FakeWorker;
  });

  afterEach(() => {
    delete (globalThis as { Worker?: unknown }).Worker;
  });

  it("starts one module worker and does not transfer the series the caller still holds", () => {
    const client = createSweepClient();
    const samples = series();
    const first = samples.sun_frac[0];
    FakeWorker.sourceBuffers = new Set([
      samples.sun_frac.buffer,
      samples.sun_el.buffer,
      samples.earth_clear.buffer,
    ]);
    client.request(job("ridge", samples, 2), () => undefined);
    client.request(job("sphere", samples, 2, null), () => undefined);
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0];
    if (!worker) throw new Error("missing worker");
    expect(String(worker.url)).toContain("sweep.worker.ts");
    expect(worker.options?.type).toBe("module");
    expect(worker.posted).toHaveLength(2);
    expect(worker.posted[0]?.hasSeries).toBe(true);
    expect(worker.posted[1]?.hasSeries).toBe(false);
    expect(worker.posted[0]?.seriesToken).toBe(worker.posted[1]?.seriesToken);
    expect(worker.posted.every((item) => item.transferredSource)).toBe(false);
    expect(samples.sun_frac[0]).toBe(first);
    expect(samples.sun_frac.buffer.byteLength).toBeGreaterThan(0);
    client.stop();
  });

  it("delivers replies out of order, drops a superseded request, and shares one request", () => {
    const client = createSweepClient();
    const samples = series();
    const got: string[] = [];
    const listen = (label: string): SweepListener => (delivery) => {
      got.push(delivery.ok ? `${label}:${delivery.sweep.slopeDeg}` : `${label}:error`);
    };
    client.request(job("ridge", samples, 2, 1), listen("ridge"));
    client.request(job("sphere", samples, 2, 2), listen("sphere"));
    const worker = FakeWorker.instances[0];
    if (!worker) throw new Error("missing worker");
    const sphere = worker.posted.find((item) => item.siteId === "sphere");
    const ridge = worker.posted.find((item) => item.siteId === "ridge");
    if (!sphere || !ridge) throw new Error("missing posts");
    worker.emit({ type: "sweep", requestId: sphere.requestId, sweep: markerSweep(2) });
    worker.emit({ type: "sweep", requestId: ridge.requestId, sweep: markerSweep(1) });
    expect(got).toEqual(["sphere:2", "ridge:1"]);

    const superseded: string[] = [];
    client.request(job("ridge", samples, 3, 4), (delivery) => {
      superseded.push(delivery.ok ? "old" : "old-error");
    });
    const before = worker.posted.length;
    const extras: string[] = [];
    client.request(job("ridge", samples, 3, 4), () => extras.push("extra"));
    client.request(job("ridge", samples, 3, 4), () => extras.push("extra"));
    expect(worker.posted.length).toBe(before);
    client.request(job("ridge", samples, 5, 9), (delivery) => {
      superseded.push(delivery.ok ? `new:${delivery.sweep.slopeDeg}` : "new-error");
    });
    const stale = worker.posted[before - 1];
    const fresh = worker.posted[worker.posted.length - 1];
    if (!stale || !fresh) throw new Error("missing profile posts");
    worker.emit({ type: "sweep", requestId: stale.requestId, sweep: markerSweep(4) });
    expect(superseded).toEqual([]);
    worker.emit({ type: "sweep", requestId: fresh.requestId, sweep: markerSweep(9) });
    expect(superseded).toEqual(["new:9"]);
    expect(extras).toEqual([]);
    client.stop();
  });

  it("reports a worker error, ignores a late reply, and stops", () => {
    const client = createSweepClient();
    const samples = series();
    const delivered: string[] = [];
    client.request(job("ridge", samples, 2), (delivery) => {
      delivered.push(delivery.ok ? "ok" : delivery.error);
    });
    const worker = FakeWorker.instances[0];
    if (!worker) throw new Error("missing worker");
    worker.onerror?.({ message: "boom" } as ErrorEvent);
    expect(delivered).toEqual(["boom"]);
    worker.emit({ type: "sweep", requestId: 1, sweep: markerSweep(1) });
    expect(delivered).toEqual(["boom"]);

    const after: string[] = [];
    client.request(job("ridge", samples, 2), () => after.push("late"));
    const restarted = FakeWorker.instances[FakeWorker.instances.length - 1];
    if (!restarted) throw new Error("missing restarted worker");
    expect(restarted.posted[0]?.hasSeries).toBe(true);
    client.stop();
    expect(restarted.terminated).toBe(true);
    restarted.emit({ type: "sweep", requestId: restarted.posted[0]?.requestId, sweep: markerSweep(1) });
    expect(after).toEqual([]);
  });
});
