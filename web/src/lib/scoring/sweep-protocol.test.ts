import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Sites } from "../../contracts/generated.ts";
import { SERIES_COLUMNS, decodeSeries } from "../../data/decode/index.ts";
import { evaluationsAtUtcMidnight, slipSweep, type Series, type SlipSweep, type Status } from "./scoring.ts";
import { siteSlopeDeg } from "./cache.ts";
import {
  SWEEP_SERIES_LIMIT,
  handleSweepRequest,
  missingSeriesMessage,
  type SweepReply,
  type SweepRequest,
  type SweepSeries,
} from "./sweep-protocol.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixtureRoot = path.join(repoRoot, "data", "fixtures");

const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8")) as Manifest;
const sites = JSON.parse(readFileSync(path.join(fixtureRoot, "sites.json"), "utf8")) as Sites;
const profiles = JSON.parse(readFileSync(path.join(fixtureRoot, "profiles.json"), "utf8")) as MissionProfile[];
const presets = ["im2_athena", "viper"].map((id) => {
  const profile = profiles.find((item) => item.id === id);
  if (!profile) throw new Error(`fixtures are missing ${id}`);
  return profile;
});
const siteIds = ["fixture_ridge", "fixture_sphere"] as const;

function loadSeries(siteId: string): Series {
  const bytes = readFileSync(path.join(fixtureRoot, "sites", siteId, "series.bin"));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, manifest.time_grid.count, "series.bin");
}

function asSweepSeries(series: Series): SweepSeries {
  return {
    sun_frac: Float64Array.from(series.sun_frac),
    sun_el: Float64Array.from(series.sun_el),
    earth_clear: Float64Array.from(series.earth_clear),
  };
}

function statuses(sweep: SlipSweep, profile: MissionProfile): Array<Status | null> {
  return evaluationsAtUtcMidnight(sweep, profile).map((row) => row?.status ?? null);
}

function maxDelta(actual: unknown, expected: unknown, label: string): number {
  if (typeof expected === "number") {
    if (typeof actual !== "number") throw new Error(`${label} is ${typeof actual}`);
    return Math.abs(actual - expected);
  }
  if (expected instanceof Float64Array || expected instanceof Int32Array || expected instanceof Uint8Array) {
    if (!(actual instanceof expected.constructor)) throw new Error(`${label} has the wrong array type`);
    const values = actual as ArrayLike<number>;
    if (values.length !== expected.length) throw new Error(`${label} length ${values.length} vs ${expected.length}`);
    let max = 0;
    for (let index = 0; index < expected.length; index += 1) {
      max = Math.max(max, maxDelta(values[index], expected[index], `${label}[${index}]`));
    }
    return max;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) throw new Error(`${label} is not the same list`);
    let max = 0;
    expected.forEach((item, index) => {
      max = Math.max(max, maxDelta(actual[index], item, `${label}[${index}]`));
    });
    return max;
  }
  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object") throw new Error(`${label} is not an object`);
    const record = actual as Record<string, unknown>;
    let max = 0;
    for (const key of Object.keys(expected)) {
      max = Math.max(max, maxDelta(record[key], (expected as Record<string, unknown>)[key], `${label}.${key}`));
    }
    return max;
  }
  if (actual !== expected) throw new Error(`${label} ${String(actual)} vs ${String(expected)}`);
  return 0;
}

describe("sweep worker handler", () => {
  it("matches slipSweep to 1e-9 and keeps the same statuses for two sites and two presets", () => {
    for (const siteId of siteIds) {
      const series = loadSeries(siteId);
      const slope = siteSlopeDeg(sites, siteId);
      for (const profile of presets) {
        const label = `${siteId} ${profile.id}`;
        const stored = new Map<number, SweepSeries>();
        const request: SweepRequest = {
          type: "sweep",
          requestId: 1,
          siteId,
          seriesToken: 1,
          series: asSweepSeries(series),
          slopeDeg: slope,
          profile,
          timeGrid: manifest.time_grid,
        };
        const reply = handleSweepRequest(request, stored);
        expect(reply.type, label).toBe("sweep");
        if (reply.type !== "sweep") continue;
        const expected = slipSweep(series, profile, slope);
        expect(maxDelta(reply.sweep, expected, label)).toBeLessThanOrEqual(1e-9);
        expect(statuses(reply.sweep, profile), label).toEqual(statuses(expected, profile));

        const again = handleSweepRequest({ ...request, requestId: 2, series: undefined }, stored);
        expect(again.type, `${label} retained`).toBe("sweep");
        if (again.type !== "sweep") continue;
        expect(maxDelta(again.sweep, expected, `${label} retained`)).toBeLessThanOrEqual(1e-9);
        expect(statuses(again.sweep, profile), `${label} retained`).toEqual(statuses(expected, profile));
      }
    }
  });

  it("rejects a time grid that does not match the series", () => {
    const series = asSweepSeries(loadSeries("fixture_ridge"));
    const profile = presets[0];
    if (!profile) throw new Error("missing preset");
    const reply = handleSweepRequest(
      {
        type: "sweep",
        requestId: 7,
        siteId: "fixture_ridge",
        seriesToken: 1,
        series,
        slopeDeg: 3,
        profile,
        timeGrid: { count: 1, start_utc: "2026-01-01T00:00:00Z", step_s: 3600 },
      },
      new Map(),
    );
    expect(reply).toEqual({
      type: "error",
      requestId: 7,
      message: `time grid has 1 hours but the series has ${series.sun_frac.length}`,
    });
  });

  it("keeps two sites' series apart, and a new token does not use the series it replaced", () => {
    const stored = new Map<number, SweepSeries>();
    const profile = shortProfile();
    const ridge = constantSeries(1);
    const sphere = constantSeries(0);
    const ridgeSweep = slipSweep(ridge, profile, null);
    const sphereSweep = slipSweep(sphere, profile, null);
    expect(maxDelta(ridgeSweep, sphereSweep, "distinct")).toBeGreaterThan(1e-9);

    expect(handleSweepRequest(tinyRequest(1, 11, "fixture_ridge", ridge), stored).type).toBe("sweep");
    expect(handleSweepRequest(tinyRequest(2, 22, "fixture_sphere", sphere), stored).type).toBe("sweep");

    const againRidge = handleSweepRequest(tinyRequest(3, 11, "fixture_ridge"), stored);
    const againSphere = handleSweepRequest(tinyRequest(4, 22, "fixture_sphere"), stored);
    expect(againRidge.type).toBe("sweep");
    expect(againSphere.type).toBe("sweep");
    if (againRidge.type !== "sweep" || againSphere.type !== "sweep") return;
    expect(maxDelta(againRidge.sweep, ridgeSweep, "ridge token")).toBeLessThanOrEqual(1e-9);
    expect(maxDelta(againSphere.sweep, sphereSweep, "sphere token")).toBeLessThanOrEqual(1e-9);

    const replacement = constantSeries(0.25);
    const replacementSweep = slipSweep(replacement, profile, null);
    expect(handleSweepRequest(tinyRequest(5, 33, "fixture_ridge", replacement), stored).type).toBe("sweep");
    const current = handleSweepRequest(tinyRequest(6, 33, "fixture_ridge"), stored);
    expect(current.type).toBe("sweep");
    if (current.type !== "sweep") return;
    expect(maxDelta(current.sweep, replacementSweep, "new token")).toBeLessThanOrEqual(1e-9);
    expect(maxDelta(current.sweep, ridgeSweep, "old series unused")).toBeGreaterThan(1e-9);

    const stale = handleSweepRequest(tinyRequest(7, 11, "fixture_ridge"), stored);
    expect(stale.type).toBe("sweep");
    if (stale.type !== "sweep") return;
    expect(maxDelta(stale.sweep, ridgeSweep, "old token still its own")).toBeLessThanOrEqual(1e-9);
    expect(maxDelta(stale.sweep, current.sweep, "old token is not the replacement")).toBeGreaterThan(1e-9);
  });

  it("drops the least recently used series once the worker is past its cap", () => {
    const stored = new Map<number, SweepSeries>();
    const profile = shortProfile();
    let requestId = 1;
    for (let token = 1; token <= SWEEP_SERIES_LIMIT; token += 1) {
      const reply = handleSweepRequest(tinyRequest(requestId, token, `site-${token}`, constantSeries(token)), stored);
      requestId += 1;
      expect(reply.type).toBe("sweep");
    }
    expect(stored.size).toBe(SWEEP_SERIES_LIMIT);

    const overflow = handleSweepRequest(
      tinyRequest(requestId, SWEEP_SERIES_LIMIT + 1, "overflow", constantSeries(100)),
      stored,
    );
    requestId += 1;
    expect(overflow.type).toBe("sweep");
    expect(stored.size).toBe(SWEEP_SERIES_LIMIT);
    expect(stored.has(1)).toBe(false);

    const goneId = requestId;
    const gone = handleSweepRequest(tinyRequest(goneId, 1, "site-1"), stored);
    requestId += 1;
    expect(gone).toEqual({
      type: "error",
      requestId: goneId,
      message: missingSeriesMessage(1),
    });

    const kept = handleSweepRequest(tinyRequest(requestId, 2, "site-2"), stored);
    requestId += 1;
    expect(kept.type).toBe("sweep");
    if (kept.type === "sweep") {
      expect(maxDelta(kept.sweep, slipSweep(constantSeries(2), profile, null), "kept")).toBeLessThanOrEqual(1e-9);
    }

    handleSweepRequest(tinyRequest(requestId, SWEEP_SERIES_LIMIT + 2, "again", constantSeries(101)), stored);
    expect(stored.has(2)).toBe(true);
    expect(stored.has(3)).toBe(false);
  });

  it("answers from the worker module and keeps the series for the next message", async () => {
    const posted: Array<{ data: SweepReply; transfer: Transferable[] }> = [];
    const globals = globalThis as { postMessage?: typeof postedPost; onmessage?: ((event: MessageEvent<SweepRequest>) => void) | null };
    const previousPost = globals.postMessage;
    const previousOn = globals.onmessage;
    globals.postMessage = (data, options) => {
      posted.push({ data, transfer: options?.transfer ?? [] });
    };
    await import("./sweep.worker.ts");
    const onmessage = globals.onmessage;
    if (!onmessage) throw new Error("sweep worker did not register onmessage");
    const profile = presets[0];
    if (!profile) throw new Error("missing preset");
    const series = asSweepSeries({
      sun_frac: Float64Array.of(1, 0, 1, 1),
      sun_el: Float64Array.of(2, 2, 2, 2),
      earth_clear: Float64Array.of(2, 2, 2, 2),
    });
    const grid = { count: 4, start_utc: "2026-01-01T00:00:00Z", step_s: 3600 };
    const first: SweepRequest = {
      type: "sweep",
      requestId: 4,
      siteId: "tiny",
      seriesToken: 9,
      series,
      slopeDeg: 3,
      profile: { ...profile, duration_days: 1 / 24 },
      timeGrid: grid,
    };
    onmessage({ data: first } as MessageEvent<SweepRequest>);
    onmessage({ data: { ...first, requestId: 5, series: undefined } } as MessageEvent<SweepRequest>);
    expect(posted.map((item) => item.data.type)).toEqual(["sweep", "sweep"]);
    expect(posted[0]?.transfer.length).toBeGreaterThan(0);
    expect(posted[1]?.data.requestId).toBe(5);
    globals.postMessage = previousPost;
    globals.onmessage = previousOn;
  });
});

function shortProfile(): MissionProfile {
  const profile = presets[0];
  if (!profile) throw new Error("missing preset");
  return { ...profile, duration_days: 1 / 24 };
}

function constantSeries(value: number): SweepSeries {
  return {
    sun_frac: Float64Array.of(value, value, value, value),
    sun_el: Float64Array.of(2, 2, 2, 2),
    earth_clear: Float64Array.of(2, 2, 2, 2),
  };
}

function tinyRequest(requestId: number, token: number, siteId: string, series?: SweepSeries): SweepRequest {
  return {
    type: "sweep",
    requestId,
    siteId,
    seriesToken: token,
    slopeDeg: null,
    profile: shortProfile(),
    timeGrid: { count: 4, start_utc: "2026-01-01T00:00:00Z", step_s: 3600 },
    ...(series ? { series } : {}),
  };
}

function postedPost(data: SweepReply, options?: { transfer?: Transferable[] }): void {
  void data;
  void options;
}
