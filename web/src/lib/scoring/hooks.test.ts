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
import { clearScoringCache } from "./cache.ts";
import { useCountdowns, useEvaluation, useHourFlags, useSweep } from "./hooks.ts";
import * as scoring from "./scoring.ts";
import { siteSlopeDeg } from "./cache.ts";
import type { Countdowns, Evaluation, HourFlags, SlipSweep } from "./scoring.ts";

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

describe("scoring hooks", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

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
    clearScoringCache();
    dataStore.setState({ entries: {} });
    delete (globalThis as { document?: unknown }).document;
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
});
