import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, useRef } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { createScenarioStore, type ScenarioCatalog } from "../../state/scenario";
import { ScenarioStoreProvider, useScenario } from "./scenario-context";
import { ViewBar } from "./view-bar";
import { useViewCommands, useViewState } from "./view-state";

/** Counts the view bar's renders: it draws one window icon per window button, two per render. */
const icons = vi.hoisted(() => ({ count: 0 }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    AppWindow: () => {
      icons.count += 1;
      return null;
    },
  };
});

const renders = () => icons.count / 2;

/** Just enough of a DOM for React to mount into, in Node. */
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

function loadCatalog(): ScenarioCatalog {
  const fixtures = path.join(repoRoot, "data", "fixtures");
  const manifest = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as ScenarioCatalog["sites"];
  return { profiles, sites, grid: manifest.time_grid };
}

/** The shell's wiring of the view bar: it re-renders on every scrub, as MissionShell does. */
function Shell() {
  useScenario((s) => s.currentUtc);
  const state = useViewState();
  const { pick } = useViewCommands(state);
  const windowButtons = useRef({});
  return createElement(ViewBar, { state, onPick: pick, windowButtons });
}

describe("the view bar's renders", () => {
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

  it("does not re-render on a scrub of the current time, only when the view changes", async () => {
    const catalog = loadCatalog();
    const store = createScenarioStore(catalog);
    const document = installDocument();
    const { createRoot } = await import("react-dom/client");
    root = createRoot(document.createElement("div") as unknown as Element);
    await act(async () => {
      // The view's "About" button links to its Academy lesson, so the bar needs a router.
      root?.render(createElement(MemoryRouter, null, createElement(ScenarioStoreProvider, { store, children: createElement(Shell) })));
    });
    const afterMount = renders();
    expect(afterMount).toBeGreaterThan(0);

    const grid = catalog.grid;
    const landing = utcToHourIndex(grid, store.getState().landingUtc);
    for (let step = 1; step <= 5; step += 1) {
      await act(async () => store.getState().setCurrentTime(hourIndexToUtc(grid, landing + step), "replace"));
    }
    expect(store.getState().currentUtc).toBe(hourIndexToUtc(grid, landing + 5));
    expect(renders()).toBe(afterMount);

    await act(async () => store.getState().setView("map"));
    expect(renders()).toBe(afterMount + 1);
  });
});
