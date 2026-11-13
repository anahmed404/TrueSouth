/**
 * The Slip Planner mounted in Node, with the real hooks (`useSlipDays`, `useSweeps`,
 * `useEvaluate`), the real scenario store and the shell's fake DOM (app/mission/fake-dom.ts),
 * plus a canvas that counts its draws. The sweep client is a stand-in that counts requests
 * and holds every reply until the test lets it go, so a test can look at the screen while a
 * sweep is still running.
 *
 * What it cannot check (by eye instead): layout, CSS (a `display: none` hides nothing here),
 * pointer and keyboard events, and how the spots sit on the scene.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, type ReactElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeNode, allNodes, propsOf, textOf } from "../../../app/mission/fake-dom";
import { ScenarioStoreProvider, useScenario, useScenarioStore } from "../../../app/mission/scenario-context";
import { useSiteStatus } from "../../../app/mission/site-status";
import type { Manifest, MissionProfile, Sites } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { slipSweep } from "../../../lib/scoring";
import type { SweepJob, SweepListener } from "../../../lib/scoring/sweep-client";
import { createScenarioStore, selectScenario, type ScenarioCatalog, type ScenarioStore } from "../../../state/scenario";
import { dataStore, seriesKey } from "../../../state/data";
import { LandingDatePanel, WHOLE_NOTE } from "./landing-date-panel";
import { SlipPlannerScene } from "./spots-layer";

/** The stand-in sweep client: every request is kept, and answered only by `deliver`. */
const client = vi.hoisted(() => ({
  requests: [] as { job: SweepJob; listener: SweepListener; active: boolean; done: boolean }[],
}));

vi.mock("../../../lib/scoring/sweep-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/scoring/sweep-client")>();
  return {
    ...actual,
    sweepWorkerAvailable: () => true,
    sharedSweepClient: () => ({
      request(job: SweepJob, listener: SweepListener) {
        const entry = { job, listener, active: true, done: false };
        client.requests.push(entry);
        return () => {
          entry.active = false;
        };
      },
      stop() {},
    }),
  };
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const json = <T>(file: string) => JSON.parse(readFileSync(path.join(fixtures, file), "utf8")) as T;
const manifest = json<Manifest>("manifest.json");
const sites = json<Sites>("sites.json");
const profiles = json<MissionProfile[]>("profiles.json");
const catalog: ScenarioCatalog = { profiles, sites, grid: manifest.time_grid };
const SITES = ["fixture_ridge", "fixture_crater", "fixture_edge"];

function loadSeries(siteId: string) {
  const bytes = readFileSync(path.join(fixtures, "sites", siteId, "series.bin"));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, manifest.time_grid.count, "series.bin");
}

const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });

/** A fake element with a size, and a canvas whose `setTransform` marks one draw. */
const canvas = { draws: 0 };
class SizedNode extends FakeNode {
  clientWidth = 800;
  offsetWidth = 120;
  offsetHeight = 20;
  width = 0;
  height = 0;
  hidden = false;
  innerHTML = "";
  title = "";
  getContext() {
    return {
      fillStyle: "",
      globalAlpha: 1,
      setTransform() {
        canvas.draws += 1;
      },
      clearRect() {},
      fillRect() {},
      beginPath() {},
      save() {},
      restore() {},
      clip() {},
      rect() {},
    };
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 800, bottom: 120, width: 800, height: 120, x: 0, y: 0 };
  }
  setPointerCapture() {}
  blur() {}
  override createElement(tag: string) {
    const node = new SizedNode(1, tag.toUpperCase());
    node.ownerDocument = this;
    return node;
  }
}

function installDocument(): SizedNode {
  const document = new SizedNode(9, "#document");
  document.ownerDocument = document;
  const host = globalThis as unknown as Record<string, unknown>;
  host.document = Object.assign(document, {
    documentElement: document.createElement("html"),
    body: document.createElement("body"),
    head: document.createElement("head"),
    activeElement: null,
    defaultView: globalThis,
  });
  host.window = globalThis;
  host.HTMLElement = class {};
  host.HTMLIFrameElement = class {};
  host.Element = class {};
  host.Node = class {};
  host.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  host.getComputedStyle = () => ({ getPropertyValue: () => "" });
  host.requestAnimationFrame ??= (callback: () => void) => setTimeout(callback, 0);
  host.cancelAnimationFrame ??= (id: number) => clearTimeout(id);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return document;
}

/** Answers every sweep request still waiting, as the worker would. */
async function deliver(): Promise<void> {
  await act(async () => {
    for (const request of client.requests) {
      if (request.done || !request.active) continue;
      request.done = true;
      request.listener({ ok: true, sweep: slipSweep(request.job.series, request.job.profile, request.job.slopeDeg) });
    }
  });
}

function Panel({ folded, compact }: { folded: boolean; compact: boolean }) {
  const store = useScenarioStore();
  const scenario = useScenario(selectScenario);
  return createElement(LandingDatePanel, {
    scenario,
    folded,
    compact,
    onToggleFold: compact ? undefined : () => undefined,
    onLandingChange: (utc, write) => store.getState().setLandingDate(utc, write),
    onFocusSite: (siteId) => store.getState().focusSite(siteId),
  });
}

function Spots() {
  const scenario = useScenario(selectScenario);
  return createElement(SlipPlannerScene, {
    projector: null,
    mode: "flat",
    canTryAgain: false,
    onTryAgain: () => undefined,
    freeSpace: { x: 0, y: 0, width: 800, height: 500, viewport: { width: 1440, height: 900 }, windowOpen: false },
    scenario,
    phone: false,
    onFocusSite: () => undefined,
  });
}

/** What the sites rail shows for one site: `useSiteStatus`, the rail's own hook. */
function Rail({ siteId }: { siteId: string }) {
  const scenario = useScenario(selectScenario);
  const status = useSiteStatus(siteId, scenario.profile, scenario.landingUtc);
  return createElement("i", { "data-rail": siteId, "data-status": status.kind === "ready" ? status.evaluation.status : status.kind });
}

describe("the Slip Planner, mounted", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  beforeEach(() => {
    client.requests.length = 0;
    canvas.draws = 0;
    dataStore.setState({
      entries: {
        manifest: ready(manifest),
        sites: ready(sites),
        profiles: ready(profiles),
        ...Object.fromEntries(SITES.map((id) => [seriesKey(id), ready(loadSeries(id))])),
      },
    });
  });

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  async function mount(store: ScenarioStore, ...children: ReactElement[]): Promise<FakeNode> {
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    await act(async () => {
      root?.render(createElement(MemoryRouter, null, createElement(ScenarioStoreProvider, { store, children })));
    });
    return host;
  }

  const search = (land: string, profile = "im2_athena") => `?profile=${profile}&sites=${SITES.join(",")}&land=${encodeURIComponent(land)}`;

  it("moving the date asks for no new sweep and redraws the strips only when the visible range moves", async () => {
    const store = createScenarioStore(catalog, search("2028-03-01T00:00Z"));
    await mount(store, createElement(Panel, { folded: false, compact: false }));
    await deliver();
    const requests = client.requests.length;
    const draws = canvas.draws;
    expect(requests).toBeGreaterThanOrEqual(SITES.length);
    expect(draws).toBeGreaterThan(0);

    // Ten days, one at a time, inside the visible range: the same sweeps, the same picture.
    for (let day = 2; day <= 11; day += 1) {
      await act(async () => store.getState().setLandingDate(`2028-03-${String(day).padStart(2, "0")}T00:00:00Z`, "replace"));
    }
    expect(client.requests.length).toBe(requests);
    expect(canvas.draws).toBe(draws);

    // A jump far out of the visible range: one redraw for the new range, still no request.
    await act(async () => store.getState().setLandingDate("2030-06-01T00:00:00Z"));
    expect(client.requests.length).toBe(requests);
    expect(canvas.draws).toBe(draws + 1);
  });

  it("while a new profile's sweep runs, every spot equals the sites rail, and no strip shows the old profile", async () => {
    const store = createScenarioStore(catalog, search("2028-03-01T00:00Z"));
    const host = await mount(
      store,
      createElement(Spots),
      createElement(Panel, { folded: false, compact: false }),
      ...SITES.map((siteId) => createElement(Rail, { key: siteId, siteId })),
    );
    await deliver();

    const spotWord = (siteId: string) => {
      const node = allNodes(host).find((n) => propsOf(n)["data-site"] === siteId && /slip-(spot|off)/.test(String(propsOf(n).className)));
      const label = String(propsOf(node!)["aria-label"]);
      return label.split(/[,.] /)[1];
    };
    const railWord = (siteId: string) => String(propsOf(allNodes(host).find((n) => propsOf(n)["data-rail"] === siteId)!)["data-status"]);

    for (const profile of ["viper", "chandrayaan3"]) {
      const waiting = client.requests.length;
      await act(async () => store.getState().choosePreset(profile));
      // The new sweeps were asked for and none has answered.
      expect(client.requests.length).toBeGreaterThan(waiting);
      expect(client.requests.filter((r) => !r.done && r.active).length).toBeGreaterThanOrEqual(SITES.length);
      for (const siteId of SITES) {
        const rail = railWord(siteId);
        expect(["GO", "CAUTION", "NO-GO", "none"]).toContain(rail);
        expect(spotWord(siteId)).toBe(rail === "none" ? "no data" : rail);
      }
      // Every strip pulses as computing: none keeps the previous profile's marks.
      expect(allNodes(host).filter((n) => propsOf(n).className === "ldp-pending")).toHaveLength(SITES.length);
      await deliver();
      expect(allNodes(host).filter((n) => propsOf(n).className === "ldp-pending")).toHaveLength(0);
      for (const siteId of SITES) expect(spotWord(siteId)).toBe(railWord(siteId) === "none" ? "no data" : railWord(siteId));
    }
  });

  for (const layout of [
    { name: "open", folded: false, compact: false },
    { name: "folded", folded: true, compact: false },
    { name: "phone", folded: false, compact: true },
  ]) {
    it(`a landing at 06:00 UTC, ${layout.name}: the 00:00 note is shown and read, and no sentence pins a 00:00 result on it`, async () => {
      const store = createScenarioStore(catalog, search("2028-08-20T06:00Z"));
      const host = await mount(store, createElement(Panel, { folded: layout.folded, compact: layout.compact }));
      await deliver();
      const text = textOf(host);
      expect(text).toContain(WHOLE_NOTE);
      expect(text).not.toContain("on this date");
      if (layout.folded) {
        expect(text).toContain("for this landing");
      } else {
        const knob = allNodes(host).find((n) => propsOf(n)["aria-label"] === "Landing date" && propsOf(n).role === "slider")!;
        const value = String(propsOf(knob)["aria-valuetext"]);
        expect(value).toContain("06:00 UTC");
        expect(value).toContain("for this landing");
        expect(value).toContain(WHOLE_NOTE);
      }
    });
  }
});
