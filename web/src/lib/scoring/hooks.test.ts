import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile, Sites } from "../../contracts/generated.ts";
import { SERIES_COLUMNS, decodeSeries } from "../../data/decode/index.ts";
import type { HookResult } from "../../data/hooks.ts";
import { dataStore, seriesKey, type ResourceEntry } from "../../state/data.ts";
import { hourIndexToUtc, utcToHourIndex } from "../time/index.ts";
import {
  SCORING_CACHE_LIMITS,
  clearScoringCache,
  peekSlipSweep,
  rememberSlipSweep,
  scoringCacheSizes,
  siteSlopeDeg,
} from "./cache.ts";
import { useCountdowns, useEvaluation, useHourFlags, useSweep, useSweeps } from "./hooks.ts";
import * as scoring from "./scoring.ts";
import { stopSharedSweepClient } from "./sweep-client.ts";
import { handleSweepRequest, type SweepRequest, type SweepSeries } from "./sweep-protocol.ts";
import type { Countdowns, Evaluation, HourFlags, Series, SlipSweep } from "./scoring.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixtureRoot = path.join(repoRoot, "data", "fixtures");

class HostNode {
  nodeType: number;
  nodeName: string;
  tagName: string;
  childNodes: HostNode[] = [];
  parentNode: HostNode | null = null;
  ownerDocument: HostNode | null = null;
  nodeValue = "";
  textContent = "";
  style: Record<string, string> = {};
  documentElement: HostNode | null = null;
  head: HostNode | null = null;
  body: HostNode | null = null;
  activeElement: HostNode | null = null;
  defaultView: object | null = null;

  constructor(nodeType: number, name: string) {
    this.nodeType = nodeType;
    this.nodeName = name;
    this.tagName = name;
  }

  get firstChild(): HostNode | null {
    return this.childNodes[0] ?? null;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  setAttribute(): void {}
  getAttribute(): null {
    return null;
  }
  removeAttribute(): void {}

  appendChild(child: HostNode): HostNode {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: HostNode): HostNode {
    this.childNodes = this.childNodes.filter((item) => item !== child);
    child.parentNode = null;
    return child;
  }

  insertBefore(child: HostNode, before: HostNode | null): HostNode {
    if (!before) return this.appendChild(child);
    const index = this.childNodes.indexOf(before);
    child.parentNode = this;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child);
    return child;
  }

  contains(other: HostNode | null): boolean {
    let current = other;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  createElement(tag: string): HostNode {
    const element = new HostNode(1, tag.toUpperCase());
    element.ownerDocument = this;
    return element;
  }

  createElementNS(namespace: string, tag: string): HostNode {
    void namespace;
    return this.createElement(tag);
  }

  createTextNode(text: string): HostNode {
    const node = new HostNode(3, "#text");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }

  createComment(text: string): HostNode {
    const node = new HostNode(8, "#comment");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }
}

function installDocument(): void {
  const document = new HostNode(9, "#document");
  document.ownerDocument = document;
  document.documentElement = new HostNode(1, "HTML");
  document.head = new HostNode(1, "HEAD");
  document.body = new HostNode(1, "BODY");
  for (const element of [document.documentElement, document.head, document.body]) {
    element.ownerDocument = document;
  }
  document.defaultView = globalThis;
  document.activeElement = null;
  const host = globalThis as unknown as Record<string, unknown>;
  host.document = document;
  host.window = globalThis;
  host.HTMLElement = class HTMLElement {};
  host.HTMLIFrameElement = class HTMLIFrameElement {};
  host.Element = class Element {};
  host.Node = class Node {};
}

function ready(data: unknown): ResourceEntry {
  return { status: "ready", data, error: null };
}

function loadSeries(siteId: string, count: number) {
  const bytes = readFileSync(path.join(fixtureRoot, "sites", siteId, "series.bin"));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, count, "series.bin");
}

const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8")) as Manifest;
const sites = JSON.parse(readFileSync(path.join(fixtureRoot, "sites.json"), "utf8")) as Sites;
const profiles = JSON.parse(readFileSync(path.join(fixtureRoot, "profiles.json"), "utf8")) as MissionProfile[];
const presets = ["im2_athena", "viper"].map((id) => {
  const profile = profiles.find((item) => item.id === id);
  if (!profile) throw new Error(`fixtures are missing ${id}`);
  return profile;
});
const siteIds = ["fixture_ridge", "fixture_sphere"] as const;

function requirePreset(index: 0 | 1): MissionProfile {
  const profile = presets[index];
  if (!profile) throw new Error("missing preset");
  return profile;
}
const landingUtc = "2028-03-01T00:00:00Z";
const landingHour = utcToHourIndex(manifest.time_grid, landingUtc);
const currentUtc = hourIndexToUtc(manifest.time_grid, landingHour + 36);

type Bundle = {
  flags: HookResult<HourFlags>;
  evaluation: HookResult<Evaluation | null>;
  countdowns: HookResult<Countdowns>;
  sweep: HookResult<SlipSweep>;
};

function seed(): void {
  const entries: Record<string, ResourceEntry> = {
    manifest: ready(manifest),
    sites: ready(sites),
  };
  for (const siteId of siteIds) {
    entries[seriesKey(siteId)] = ready(loadSeries(siteId, manifest.time_grid.count));
  }
  dataStore.setState({ entries });
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

class HookWorker {
  static latest: HookWorker | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: SweepRequest[] = [];
  terminated = false;

  constructor(
    public url: string | URL,
    public options?: { type?: string },
  ) {
    HookWorker.latest = this;
  }

  postMessage(data: SweepRequest): void {
    this.posted.push(data);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

let root: Root | null = null;

function installHookWorker(): void {
  HookWorker.latest = null;
  (globalThis as { Worker: unknown }).Worker = HookWorker;
}

function requireWorker(): HookWorker {
  const worker = HookWorker.latest;
  if (!worker) throw new Error("the sweep client did not start a worker");
  return worker;
}

async function renderProbe(probe: () => null): Promise<void> {
  installDocument();
  const container = (globalThis.document as unknown as HostNode).createElement("div");
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(createElement(probe));
  });
}

async function settleSweep(store: Map<number, SweepSeries>): Promise<void> {
  const worker = requireWorker();
  const batch = worker.posted.splice(0, worker.posted.length);
  await act(async () => {
    for (const request of batch) worker.emit(handleSweepRequest(request, store));
  });
}

describe("scoring hooks", () => {
  const hadWindow = "window" in globalThis;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => {
        mounted.unmount();
      });
    }
    stopSharedSweepClient();
    clearScoringCache();
    dataStore.setState({ entries: {} });
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { Worker?: unknown }).Worker;
    HookWorker.latest = null;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  it("returns the pure scoring result for two fixture sites and two presets", async () => {
    seed();
    installDocument();
    const container = (globalThis.document as unknown as HostNode).createElement("div");
    root = createRoot(container as unknown as Element);

    for (const siteId of siteIds) {
      for (const profile of presets) {
        let latest: Bundle | null = null;
        function Probe() {
          latest = {
            flags: useHourFlags(siteId, profile),
            evaluation: useEvaluation(siteId, profile, landingUtc),
            countdowns: useCountdowns(siteId, profile, currentUtc),
            sweep: useSweep(siteId, profile),
          };
          return null;
        }
        await act(async () => {
          root?.render(createElement(Probe));
        });
        const label = `${siteId} ${profile.id}`;
        if (!latest) throw new Error(`${label} did not render`);
        const rendered: Bundle = latest;
        expect(rendered.flags.status, label).toBe("ready");
        expect(rendered.evaluation.status, label).toBe("ready");
        expect(rendered.countdowns.status, label).toBe("ready");
        expect(rendered.sweep.status, label).toBe("ready");
        const series = loadSeries(siteId, manifest.time_grid.count);
        const slope = siteSlopeDeg(sites, siteId);
        expect(maxDelta(rendered.flags.data, scoring.hourFlags(series, profile), `${label} flags`)).toBeLessThanOrEqual(
          1e-9,
        );
        expect(
          maxDelta(
            rendered.evaluation.data,
            scoring.evaluate(series, profile, landingHour, slope),
            `${label} evaluation`,
          ),
        ).toBeLessThanOrEqual(1e-9);
        expect(
          maxDelta(
            rendered.countdowns.data,
            scoring.countdowns(series, profile, landingHour + 36),
            `${label} countdowns`,
          ),
        ).toBeLessThanOrEqual(1e-9);
        expect(
          maxDelta(rendered.sweep.data, scoring.slipSweep(series, profile, slope), `${label} sweep`),
        ).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it("does not recompute when an unrelated part of the store changes", async () => {
    const spy = vi.spyOn(scoring, "hourFlags");
    seed();
    installDocument();
    const found = presets[0];
    if (!found) throw new Error("missing preset");
    const profile: MissionProfile = found;
    const seen: { flags: HookResult<HourFlags> | null; bump: ((value: number) => void) | null } = {
      flags: null,
      bump: null,
    };

    function Probe() {
      const [tick, setTick] = useState(0);
      seen.bump = setTick;
      seen.flags = useHourFlags("fixture_ridge", profile);
      void tick;
      return null;
    }

    const container = (globalThis.document as unknown as HostNode).createElement("div");
    root = createRoot(container as unknown as Element);
    await act(async () => {
      root?.render(createElement(Probe));
    });
    expect(seen.flags?.status).toBe("ready");
    const calls = spy.mock.calls.length;
    expect(calls).toBeGreaterThan(0);

    await act(async () => {
      dataStore.setState((state) => ({
        entries: {
          ...state.entries,
          features: ready({ unrelated: true }),
        },
      }));
      seen.bump?.(1);
    });
    expect(spy.mock.calls.length).toBe(calls);
  });

  it("falls back to the main thread when Worker does not exist", async () => {
    expect((globalThis as { Worker?: unknown }).Worker).toBeUndefined();
    seed();
    const profile = requirePreset(0);
    const seen: { sweep: HookResult<SlipSweep> | null } = { sweep: null };
    function Probe() {
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    const series = loadSeries("fixture_ridge", manifest.time_grid.count);
    const slope = siteSlopeDeg(sites, "fixture_ridge");
    expect(seen.sweep?.status).toBe("ready");
    expect(maxDelta(seen.sweep?.data, scoring.slipSweep(series, profile, slope), "fallback")).toBeLessThanOrEqual(1e-9);
    expect(HookWorker.latest).toBeNull();
  });

  it("does not post again for a second mount, and a new site still respects the cache cap", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const tiny = {
      sun_frac: Float64Array.of(1, 0, 1, 1),
      sun_el: Float64Array.of(2, 2, 2, 2),
      earth_clear: Float64Array.of(2, 0, 2, 2),
    };
    const pad = scoring.slipSweep(tiny, profile, 1);
    for (let index = 0; index < SCORING_CACHE_LIMITS.sweeps; index += 1) {
      rememberSlipSweep(`pad-${index}`, tiny, profile, 1, pad);
    }
    const seen: { sweep: HookResult<SlipSweep> | null } = { sweep: null };
    function Probe() {
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    const worker = requireWorker();
    expect(worker.posted).toHaveLength(1);
    const store = new Map<number, SweepSeries>();
    await settleSweep(store);
    expect(seen.sweep?.status).toBe("ready");
    const first = seen.sweep?.data;
    expect(scoringCacheSizes().sweeps).toBe(SCORING_CACHE_LIMITS.sweeps);
    expect(peekSlipSweep("pad-0", tiny, profile, 1)).toBeUndefined();

    const posts = worker.posted.length;
    await act(async () => {
      root?.unmount();
    });
    root = null;
    await renderProbe(Probe);
    expect(worker.posted.length).toBe(posts);
    expect(seen.sweep?.status).toBe("ready");
    expect(seen.sweep?.data).toBe(first);
  });

  it("keeps useSweeps in site order and does not recompute a cached site", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const seen: {
      rows: HookResult<SlipSweep>[] | null;
      setIds: ((ids: string[]) => void) | null;
    } = { rows: null, setIds: null };
    function Probe() {
      const [ids, setIds] = useState(["fixture_ridge"]);
      seen.setIds = setIds;
      seen.rows = useSweeps(ids, profile);
      return null;
    }
    await renderProbe(Probe);
    const store = new Map<number, SweepSeries>();
    expect(requireWorker().posted).toHaveLength(1);
    await settleSweep(store);
    const first = seen.rows?.[0];
    expect(first?.status).toBe("ready");

    await act(async () => {
      seen.setIds?.(["fixture_ridge", "fixture_sphere"]);
    });
    expect(seen.rows?.[0]?.data).toBe(first?.data);
    expect(seen.rows?.[1]?.status).toBe("loading");
    expect(requireWorker().posted).toHaveLength(1);
    await settleSweep(store);
    expect(seen.rows?.map((row) => row.status)).toEqual(["ready", "ready"]);
    expect(seen.rows?.[0]?.data).toBe(first?.data);
  });

  it("fills useSweeps in siteIds order when replies arrive out of order", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const seen: { rows: HookResult<SlipSweep>[] | null } = { rows: null };
    function Probe() {
      seen.rows = useSweeps(["fixture_ridge", "fixture_sphere"], profile);
      return null;
    }
    await renderProbe(Probe);
    const worker = requireWorker();
    expect(worker.posted.map((item) => item.siteId)).toEqual(["fixture_ridge", "fixture_sphere"]);
    const store = new Map<number, SweepSeries>();
    const ridge = worker.posted[0];
    const sphere = worker.posted[1];
    if (!ridge || !sphere) throw new Error("missing sweep requests");
    await act(async () => {
      worker.emit(handleSweepRequest(sphere, store));
    });
    expect(seen.rows?.map((row) => row.status)).toEqual(["loading", "ready"]);
    await act(async () => {
      worker.emit(handleSweepRequest(ridge, store));
    });
    expect(seen.rows?.map((row) => row.status)).toEqual(["ready", "ready"]);
  });

  it("does not apply a superseded reply or a reply after unmount", async () => {
    seed();
    installHookWorker();
    const im2 = requirePreset(0);
    const viper = requirePreset(1);
    const seen: {
      sweep: HookResult<SlipSweep> | null;
      setProfile: ((profile: MissionProfile) => void) | null;
    } = { sweep: null, setProfile: null };
    function Probe() {
      const [profile, setProfile] = useState(im2);
      seen.setProfile = setProfile;
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    const worker = requireWorker();
    const stale = worker.posted[0];
    if (!stale) throw new Error("missing sweep request");
    await act(async () => {
      seen.setProfile?.(viper);
    });
    const current = worker.posted[1];
    if (!current) throw new Error("missing superseded sweep request");
    const store = new Map<number, SweepSeries>();
    await act(async () => {
      worker.emit(handleSweepRequest(stale, store));
    });
    expect(seen.sweep?.status).toBe("loading");
    await act(async () => {
      worker.emit(handleSweepRequest(current, store));
    });
    expect(seen.sweep?.status).toBe("ready");
    const series = loadSeries("fixture_ridge", manifest.time_grid.count);
    const slope = siteSlopeDeg(sites, "fixture_ridge");
    expect(maxDelta(seen.sweep?.data, scoring.slipSweep(series, viper, slope), "viper")).toBeLessThanOrEqual(1e-9);

    await act(async () => {
      root?.unmount();
    });
    root = null;
    const storedRidge = dataStore.getState().entries[seriesKey("fixture_ridge")]?.data as Series;
    expect(peekSlipSweep("fixture_ridge", storedRidge, viper, slope, manifest.time_grid)).toBe(seen.sweep?.data);
    function Again() {
      useSweep("fixture_sphere", im2);
      return null;
    }
    await renderProbe(Again);
    const posted = worker.posted.length;
    const late = worker.posted[posted - 1];
    if (!late) throw new Error("missing sphere request");
    await act(async () => {
      root?.unmount();
    });
    root = null;
    await act(async () => {
      worker.emit(handleSweepRequest(late, store));
    });
    const storedSphere = dataStore.getState().entries[seriesKey("fixture_sphere")]?.data as Series;
    expect(
      peekSlipSweep("fixture_sphere", storedSphere, im2, siteSlopeDeg(sites, "fixture_sphere"), manifest.time_grid),
    ).toBeUndefined();
  });

  it("posts one request for many subscribers and surfaces a worker error", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const seen: { sweep: HookResult<SlipSweep> | null } = { sweep: null };
    function Probe() {
      seen.sweep = useSweep("fixture_ridge", profile);
      useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    const worker = requireWorker();
    expect(worker.posted).toHaveLength(1);
    const series = loadSeries("fixture_ridge", manifest.time_grid.count);
    expect(series.sun_frac.buffer.byteLength).toBeGreaterThan(0);
    await act(async () => {
      worker.onerror?.({ message: "worker exploded" } as ErrorEvent);
    });
    expect(seen.sweep?.status).toBe("error");
    expect(seen.sweep?.error).toBe("worker exploded");
    expect(series.sun_frac.buffer.byteLength).toBeGreaterThan(0);
  });

  it("does not return a cached sweep when the same series is read on a different grid", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const seen: { sweep: HookResult<SlipSweep> | null } = { sweep: null };
    function Probe() {
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    await settleSweep(new Map());
    expect(seen.sweep?.status).toBe("ready");
    const cached = seen.sweep?.data;
    await act(async () => {
      dataStore.setState((state) => ({
        entries: {
          ...state.entries,
          manifest: ready({
            ...manifest,
            time_grid: { ...manifest.time_grid, count: manifest.time_grid.count + 1 },
          }),
        },
      }));
    });
    expect(seen.sweep?.status).toBe("loading");
    expect(seen.sweep?.data).toBeNull();
    expect(seen.sweep?.data).not.toBe(cached);
    expect(requireWorker().posted).toHaveLength(1);
    expect(requireWorker().posted[0]?.timeGrid.count).toBe(manifest.time_grid.count + 1);
  });

  it("surfaces a messageerror as a hook error", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const seen: { sweep: HookResult<SlipSweep> | null } = { sweep: null };
    function Probe() {
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    const worker = requireWorker();
    await act(async () => {
      worker.onmessageerror?.({} as MessageEvent);
    });
    expect(seen.sweep?.status).toBe("error");
    expect(seen.sweep?.error).toBe("sweep worker could not read a message");
  });

  it("reports a Worker constructor failure and does not stay loading", async () => {
    seed();
    class BlockedWorker {
      constructor() {
        throw new Error("content security policy");
      }
    }
    (globalThis as { Worker: unknown }).Worker = BlockedWorker;
    const profile = requirePreset(0);
    const seen: { sweep: HookResult<SlipSweep> | null } = { sweep: null };
    function Probe() {
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    expect(seen.sweep?.status).toBe("error");
    expect(seen.sweep?.error).toBe("content security policy");
    expect(seen.sweep?.data).toBeNull();
  });

  it("answers a later request after a worker error", async () => {
    seed();
    installHookWorker();
    const im2 = requirePreset(0);
    const viper = requirePreset(1);
    const seen: {
      sweep: HookResult<SlipSweep> | null;
      setProfile: ((profile: MissionProfile) => void) | null;
    } = { sweep: null, setProfile: null };
    function Probe() {
      const [profile, setProfile] = useState(im2);
      seen.setProfile = setProfile;
      seen.sweep = useSweep("fixture_ridge", profile);
      return null;
    }
    await renderProbe(Probe);
    const failed = requireWorker();
    await act(async () => {
      failed.onerror?.({ message: "boom" } as ErrorEvent);
    });
    expect(seen.sweep?.status).toBe("error");
    expect(failed.terminated).toBe(true);
    await act(async () => {
      seen.setProfile?.(viper);
    });
    const restarted = requireWorker();
    expect(restarted).not.toBe(failed);
    expect(restarted.terminated).toBe(false);
    expect(restarted.posted[0]?.series).toBeDefined();
    await settleSweep(new Map());
    expect(seen.sweep?.status).toBe("ready");
    const series = loadSeries("fixture_ridge", manifest.time_grid.count);
    const slope = siteSlopeDeg(sites, "fixture_ridge");
    expect(maxDelta(seen.sweep?.data, scoring.slipSweep(series, viper, slope), "after error")).toBeLessThanOrEqual(
      1e-9,
    );
  });

  it("shares one sweep for duplicate ids, returns nothing for an empty list, and fills eight sites", async () => {
    seed();
    installHookWorker();
    const profile = requirePreset(0);
    const duplicate: { rows: HookResult<SlipSweep>[] | null } = { rows: null };
    function Duplicates() {
      duplicate.rows = useSweeps(["fixture_ridge", "fixture_ridge"], profile);
      return null;
    }
    await renderProbe(Duplicates);
    expect(requireWorker().posted).toHaveLength(1);
    await settleSweep(new Map());
    expect(duplicate.rows?.map((row) => row.status)).toEqual(["ready", "ready"]);
    expect(duplicate.rows?.[0]?.data).toBe(duplicate.rows?.[1]?.data);

    await act(async () => {
      root?.unmount();
    });
    root = null;
    stopSharedSweepClient();
    clearScoringCache();
    HookWorker.latest = null;

    const empty: { rows: HookResult<SlipSweep>[] | null } = { rows: null };
    function Empty() {
      empty.rows = useSweeps([], profile);
      return null;
    }
    await renderProbe(Empty);
    expect(empty.rows).toEqual([]);
    expect(HookWorker.latest).toBeNull();

    await act(async () => {
      root?.unmount();
    });
    root = null;

    const count = 4;
    const ids = Array.from({ length: 8 }, (_, index) => `c_${(index + 1).toFixed(4)}_${(index + 10).toFixed(4)}`);
    const short = { ...profile, duration_days: 1 / 24 };
    dataStore.setState({
      entries: {
        manifest: ready({ ...manifest, time_grid: { ...manifest.time_grid, count } }),
        sites: ready(sites),
        ...Object.fromEntries(
          ids.map((siteId, index) => [
            seriesKey(siteId),
            ready({
              sun_frac: Float64Array.of(index + 1, index + 1, index + 1, index + 1),
              sun_el: Float64Array.of(2, 2, 2, 2),
              earth_clear: Float64Array.of(2, 2, 2, 2),
            }),
          ]),
        ),
      },
    });
    const eight: { rows: HookResult<SlipSweep>[] | null } = { rows: null };
    function Eight() {
      eight.rows = useSweeps(ids, short);
      return null;
    }
    await renderProbe(Eight);
    expect(requireWorker().posted).toHaveLength(8);
    await settleSweep(new Map());
    expect(eight.rows?.map((row) => row.status)).toEqual(Array.from({ length: 8 }, () => "ready"));
    ids.forEach((siteId, index) => {
      const series = {
        sun_frac: Float64Array.of(index + 1, index + 1, index + 1, index + 1),
        sun_el: Float64Array.of(2, 2, 2, 2),
        earth_clear: Float64Array.of(2, 2, 2, 2),
      };
      expect(
        maxDelta(eight.rows?.[index]?.data, scoring.slipSweep(series, short, null), siteId),
      ).toBeLessThanOrEqual(1e-9);
    });
  });
});
