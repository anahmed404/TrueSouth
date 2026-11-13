/**
 * "The view stays smooth while the scrubber plays" (docs/features/panorama.md): only the
 * discs move with time. The skyline, the paths and the axes are one memoised layer that
 * does not redraw when the hour changes, only when the view turns.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Manifest, SiteMeta } from "../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries, decodeSkyline } from "../../data/decode/index";

/** Counts the layer's work: building the skyline's vertices, and the static layer's renders. */
const calls = vi.hoisted(() => ({ vertices: 0, staticRenders: 0, discs: 0 }));
vi.mock("./geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./geometry")>();
  return {
    ...actual,
    skylineVertices: (...args: Parameters<typeof actual.skylineVertices>) => {
      calls.vertices += 1;
      return actual.skylineVertices(...args);
    },
    // Called once in each render of the static layer.
    elevationTicks: (...args: Parameters<typeof actual.elevationTicks>) => {
      calls.staticRenders += 1;
      return actual.elevationTicks(...args);
    },
    discShape: (...args: Parameters<typeof actual.discShape>) => {
      calls.discs += 1;
      return actual.discShape(...args);
    },
  };
});

const { HorizonChart } = await import("./chart");
const { autoRange, chartFrame, chartScales } = await import("./geometry");

/** Just enough of a DOM for React to mount into, in Node (as in app/mission/view-bar.test.ts). */
class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  ownerDocument: FakeNode | null = null;
  style: Record<string, string> = {};
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
  setAttribute() {}
  removeAttribute() {}
  getAttribute() {
    return null;
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

function installDocument(): FakeNode {
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
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return document;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadFixture(siteId: string) {
  const dir = path.join(repoRoot, "data", "fixtures");
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest;
  const read = (file: string) => {
    const bytes = readFileSync(path.join(dir, "sites", siteId, file));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
  };
  return {
    series: decodeSeries(read("series.bin"), SERIES_COLUMNS, manifest.time_grid.count, "series.bin"),
    skyline: decodeSkyline(read("skyline.bin"), manifest.skyline_bins, "skyline.bin"),
    meta: JSON.parse(readFileSync(path.join(dir, "sites", siteId, "meta.json"), "utf8")) as SiteMeta,
  };
}

describe("the horizon chart while the scrubber plays", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  it("moves only the discs: the skyline and paths are not rebuilt per hour, only when the view turns", async () => {
    const { series, skyline, meta } = loadFixture("fixture_ridge");
    const window = { from: 4700, to: 4940 };
    const radii = { sun: meta.sun_radius_deg, earth: meta.earth_radius_deg };
    const range = autoRange({
      skylineEl: skyline.el_deg,
      sunEl: series.sun_el,
      earthEl: series.earth_el,
      from: window.from,
      to: window.to,
      sunRadiusDeg: radii.sun,
      earthRadiusDeg: radii.earth,
    });
    const frame = chartFrame(720);
    const facing = chartScales(frame, 30, range);
    const props = (hour: number, scales = facing) =>
      createElement(HorizonChart, {
        scales,
        skyline,
        series,
        window,
        hour,
        landingHour: window.from,
        radii,
        maskDeg: 1,
        features: [],
        marker: null,
        onMark: () => undefined,
        onCentreChange: () => undefined,
        onZoom: () => undefined,
        onResetZoom: () => undefined,
        utcOfHour: () => "2026-07-15T12:00:00Z",
        showLabels: true,
        label: "Horizon chart",
      });

    const document = installDocument();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(document.createElement("div") as unknown as Element);
    await act(async () => root?.render(props(window.from)));
    const mounted = { ...calls };
    expect(mounted.vertices).toBe(1);
    expect(mounted.staticRenders).toBe(1);

    for (let step = 1; step <= 24; step += 1) {
      await act(async () => root?.render(props(window.from + step)));
    }
    expect(calls.vertices).toBe(mounted.vertices);
    expect(calls.staticRenders).toBe(mounted.staticRenders);
    // The discs did move: each hour placed them again.
    expect(calls.discs).toBeGreaterThan(mounted.discs + 24);

    // Turning the view redraws the layer once.
    await act(async () => root?.render(props(window.from + 24, chartScales(frame, 90, range))));
    expect(calls.vertices).toBe(mounted.vertices + 1);
    expect(calls.staticRenders).toBe(mounted.staticRenders + 1);
  });
});
