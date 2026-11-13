/**
 * Folding Lander's eye's chart (docs/features/panorama.md, "What is behind and what floats
 * above"): folded by default in Mission Control, always open with no toggle in a lesson; the
 * toggle's state and names; the session's memory; the foot row saying the same in both
 * states; and no chart drawn while the scrubber moves with the chart folded.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Features, Manifest, MissionProfile, SiteMeta, Sites } from "../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries, decodeSkyline } from "../../data/decode/index";
import { hourFlags } from "../../lib/scoring";
import { hourIndexToUtc } from "../../lib/time";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../state/data";
import { CHART_FOLD_KEY } from "./fold";

/** Counts the chart's work: building the skyline, and renders of its static layer. */
const calls = vi.hoisted(() => ({ vertices: 0, staticRenders: 0 }));
vi.mock("./geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geometry")>();
  return {
    ...actual,
    skylineVertices: (...args: Parameters<typeof actual.skylineVertices>) => {
      calls.vertices += 1;
      return actual.skylineVertices(...args);
    },
    elevationTicks: (...args: Parameters<typeof actual.elevationTicks>) => {
      calls.staticRenders += 1;
      return actual.elevationTicks(...args);
    },
  };
});

const { default: LandersEye } = await import("./index");

/** A DOM just big enough for React, in Node, that keeps attributes so the test can read them. */
class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  ownerDocument: FakeNode | null = null;
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  nodeValue = "";
  textContent = "";
  constructor(
    readonly nodeType: number,
    readonly nodeName: string,
  ) {}
  get tagName() {
    return this.nodeName;
  }
  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }
  addEventListener() {}
  removeEventListener() {}
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  querySelector() {
    return null;
  }
  appendChild(child: FakeNode) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child: FakeNode) {
    this.childNodes = this.childNodes.filter((node) => node !== child);
    return child;
  }
  insertBefore(child: FakeNode, before: FakeNode | null) {
    if (!before) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(Math.max(0, this.childNodes.indexOf(before)), 0, child);
    return child;
  }
  contains(other: FakeNode | null): boolean {
    for (let node = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  }
  createElement(tag: string) {
    const node = new FakeNode(1, tag.toUpperCase());
    node.ownerDocument = this;
    return node;
  }
  createElementNS(_namespace: string, tag: string) {
    return this.createElement(tag);
  }
  createTextNode(text: string) {
    const node = new FakeNode(3, "#text");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }
  createComment(text: string) {
    const node = new FakeNode(8, "#comment");
    node.nodeValue = text;
    return node;
  }
}

/** The class names React gave a node: as the `class` attribute, or the `className` property. */
function classes(node: FakeNode): string[] {
  const value = node.getAttribute("class") ?? (node as unknown as { className?: string }).className ?? "";
  return String(value).split(/\s+/).filter(Boolean);
}

function find(root: FakeNode, test: (node: FakeNode) => boolean): FakeNode | null {
  if (test(root)) return root;
  for (const child of root.childNodes) {
    const hit = find(child, test);
    if (hit) return hit;
  }
  return null;
}

const byClass = (root: FakeNode, name: string) => find(root, (n) => n.nodeType === 1 && classes(n).includes(name));

/** All the text under a node, in order. */
function text(node: FakeNode | null): string {
  if (!node) return "";
  if (node.nodeType === 3) return node.nodeValue;
  if (node.childNodes.length === 0) return node.textContent ?? "";
  return node.childNodes.map(text).join("");
}

/** Calls a node's React click handler, as a click on it would. */
function click(node: FakeNode) {
  const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
  const props = key ? (node as unknown as Record<string, { onClick?: () => void }>)[key] : undefined;
  if (!props?.onClick) throw new Error("no click handler");
  props.onClick();
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const dir = path.join(repoRoot, "data", "fixtures");
const json = <T,>(file: string) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;
const read = (file: string) => {
  const bytes = readFileSync(path.join(dir, "sites", "fixture_ridge", file));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};
const manifest = json<Manifest>("manifest.json");
const grid = manifest.time_grid;
const series = decodeSeries(read("series.bin"), SERIES_COLUMNS, grid.count, "series.bin");
const skyline = decodeSkyline(read("skyline.bin"), manifest.skyline_bins, "skyline.bin");
const meta = JSON.parse(readFileSync(path.join(dir, "sites", "fixture_ridge", "meta.json"), "utf8")) as SiteMeta;
const profile = json<MissionProfile[]>("profiles.json").find((p) => p.id === "im2_athena")!;
// A fixture window with both lit, linked hours and dark ones.
const LANDING = 5280;

/** A lit and linked hour, and a dark one, in the fixture's mission window. */
const flags = hourFlags(series, profile);
const litHour = Array.from({ length: 240 }, (_, i) => LANDING + i).find((h) => flags.lit[h] === 1 && flags.link[h] === 1)!;
const darkHour = Array.from({ length: 240 }, (_, i) => LANDING + i).find((h) => flags.lit[h] !== 1)!;

function view(mode: "mission" | "lesson", hour: number, marker: { azDeg: number } | null = null) {
  return createElement(LandersEye, {
    mode,
    marker,
    onMarkerChange: () => undefined,
    scenario: {
      profile,
      siteIds: ["fixture_ridge"],
      focusedSiteId: "fixture_ridge",
      landingUtc: hourIndexToUtc(grid, LANDING),
      currentUtc: hourIndexToUtc(grid, hour),
    },
  });
}

describe("folding the horizon chart", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;
  let container: FakeNode;
  const session = new Map<string, string>();

  beforeAll(() => {
    const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
    dataStore.setState({
      entries: {
        manifest: ready(manifest),
        sites: ready(json<Sites>("sites.json")),
        features: ready(json<Features>("features.json")),
        [metaKey("fixture_ridge")]: ready(meta),
        [seriesKey("fixture_ridge")]: ready(series),
        [skylineKey("fixture_ridge")]: ready(skyline),
      },
    });
    expect(litHour).toBeDefined();
    expect(darkHour).toBeDefined();
  });

  async function mount(element: ReturnType<typeof view>) {
    const document = new FakeNode(9, "#document");
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
    host.sessionStorage = {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
    };
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = await import("react-dom/client");
    container = document.createElement("div");
    root = createRoot(container as unknown as Element);
    await act(async () => root?.render(element));
  }

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    session.clear();
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  it("is folded by default in Mission Control: the row, the toggle and no chart", async () => {
    const before = { ...calls };
    await mount(view("mission", litHour));
    const toggle = byClass(container, "pano-toggle")!;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Show the horizon chart");
    // Folded, the body is unmounted, so the toggle must not point at an id that is not there.
    expect(toggle.getAttribute("aria-controls")).toBeNull();
    expect(text(toggle)).toContain("Horizon chart");
    expect(byClass(container, "pano-body")).toBeNull();
    expect(byClass(container, "pano-chart")).toBeNull();
    expect(byClass(container, "pano-legend")).toBeNull();
    expect(byClass(container, "pano-centre")).toBeNull();
    expect(byClass(container, "pano-panel")?.getAttribute("data-collapsed")).toBe("true");
    expect(calls.vertices).toBe(before.vertices);
  });

  it("opens and closes with the one toggle, which keeps its place, and remembers the choice", async () => {
    await mount(view("mission", litHour));
    const toggle = byClass(container, "pano-toggle")!;
    await act(async () => click(toggle));
    // The same element, so focus stays on it.
    expect(byClass(container, "pano-toggle")).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Hide the horizon chart");
    const body = byClass(container, "pano-body")!;
    expect(body.getAttribute("id")).toBe(toggle.getAttribute("aria-controls"));
    expect(byClass(container, "pano-chart")).not.toBeNull();
    expect(byClass(container, "pano-legend")).not.toBeNull();
    expect(session.get(CHART_FOLD_KEY)).toBe("open");

    await act(async () => click(toggle));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(byClass(container, "pano-chart")).toBeNull();
    expect(session.get(CHART_FOLD_KEY)).toBe("closed");
  });

  it("opens straight away when this session last left it open", async () => {
    session.set(CHART_FOLD_KEY, "open");
    await mount(view("mission", litHour));
    expect(byClass(container, "pano-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(byClass(container, "pano-chart")).not.toBeNull();
  });

  it("is always open with no toggle in a lesson, even with a marker and a folded session", async () => {
    session.set(CHART_FOLD_KEY, "closed");
    const before = { ...calls };
    await mount(view("lesson", litHour, { azDeg: 90 }));
    expect(byClass(container, "pano-toggle")).toBeNull();
    expect(byClass(container, "pano-chart")).not.toBeNull();
    expect(byClass(container, "pano-marker")).not.toBeNull();
    expect(calls.vertices).toBe(before.vertices + 1);
  });

  for (const [name, hour] of [
    ["a lit, linked hour", () => litHour],
    ["a dark hour", () => darkHour],
  ] as const) {
    it(`the folded row says what the open panel's foot says, at ${name}`, async () => {
      await mount(view("mission", hour()));
      const folded = text(byClass(container, "pano-foot-why"));
      expect(folded.length).toBeGreaterThan(10);
      await act(async () => click(byClass(container, "pano-toggle")!));
      expect(text(byClass(container, "pano-foot-why"))).toBe(folded);
    });
  }

  it("draws no chart while the scrubber moves with the chart folded", async () => {
    await mount(view("mission", LANDING));
    const mounted = { ...calls };
    for (let step = 1; step <= 24; step += 1) {
      await act(async () => root?.render(view("mission", LANDING + step)));
    }
    expect(calls.vertices).toBe(mounted.vertices);
    expect(calls.staticRenders).toBe(mounted.staticRenders);
    expect(byClass(container, "pano-chart")).toBeNull();
  });
});
