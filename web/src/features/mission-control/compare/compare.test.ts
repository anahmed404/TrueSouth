/**
 * The Compare window on the shared fixture (docs/features/compare.md, "Done when"):
 *
 * - every value in a site's column is the focused-site panel's value for the same site,
 *   profile and landing date, read through the same hook (`useSiteStatus`);
 * - the table draws those values;
 * - a scrub of the current time does not re-render the table, and a new landing date does.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Sites } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { describeEvaluation, describeMetrics, formatValue, scoreText } from "../../../app/mission/rules";
import { ScenarioStoreProvider } from "../../../app/mission/scenario-context";
import { useSiteStatus, type SiteStatus } from "../../../app/mission/site-status";
import { hourIndexToUtc } from "../../../lib/time";
import { dataStore, seriesKey } from "../../../state/data";
import { createScenarioStore, type ScenarioCatalog } from "../../../state/scenario";
import Compare, { CompareTable, compareRenders } from "./index";
import { compareColumn, metricRows, statusCells, summarySentence, type ColumnView } from "./model";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const json = <T,>(file: string) => JSON.parse(readFileSync(path.join(fixtures, file), "utf8")) as T;
const manifest = json<Manifest>("manifest.json");
const sites = json<Sites>("sites.json");
const profiles = json<MissionProfile[]>("profiles.json");
const SITE_IDS = sites.map((s) => s.id);
const grid = manifest.time_grid;

function seed(): void {
  const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
  const entries: Record<string, ReturnType<typeof ready>> = { manifest: ready(manifest), sites: ready(sites) };
  for (const id of SITE_IDS) {
    const bytes = readFileSync(path.join(fixtures, "sites", id, "series.bin"));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    entries[seriesKey(id)] = ready(decodeSeries(copy, SERIES_COLUMNS, grid.count, "series.bin"));
  }
  dataStore.setState({ entries });
}

/** Just enough of a DOM for React to mount into, in Node (as in features/panorama/renders.test.ts). */
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

const hadWindow = "window" in globalThis;
let root: Root | null = null;

async function mount(node: ReactNode): Promise<void> {
  const document = installDocument();
  const { createRoot } = await import("react-dom/client");
  root = createRoot(document.createElement("div") as unknown as Element);
  await act(async () => root?.render(routed(node)));
}

/** Explain tips link to Academy lessons, so a router must be around. */
function routed(node: ReactNode) {
  return createElement(MemoryRouter, null, node);
}

afterEach(async () => {
  if (root) {
    const mounted = root;
    root = null;
    await act(async () => mounted.unmount());
  }
  delete (globalThis as { document?: unknown }).document;
  if (!hadWindow) delete (globalThis as { window?: unknown }).window;
});

beforeAll(seed);

const catalog: ScenarioCatalog = { profiles, sites, grid };

/** Reads each site's status through the focused-site panel's own hook. */
async function panelStatuses(profile: MissionProfile, landingUtc: string): Promise<Record<string, SiteStatus>> {
  const seen: Record<string, SiteStatus> = {};
  function Probe({ siteId }: { siteId: string }) {
    seen[siteId] = useSiteStatus(siteId, profile, landingUtc);
    return null;
  }
  await mount(createElement("div", null, ...SITE_IDS.map((id) => createElement(Probe, { key: id, siteId: id }))));
  return seen;
}

/** Three landing dates and every preset, so GO, CAUTION and NO-GO all appear. */
const CASES = profiles.flatMap((profile) => [4700, 12000, 30000].map((hour) => ({ profile, landingUtc: hourIndexToUtc(grid, hour) })));

describe("a Compare column equals the focused-site panel for the same site, profile and date", () => {
  it("covers GO, CAUTION and NO-GO on the fixture", async () => {
    const seenStatuses = new Set<string>();
    for (const { profile, landingUtc } of CASES) {
      const statuses = await panelStatuses(profile, landingUtc);
      await act(async () => root?.unmount());
      root = null;
      for (const s of Object.values(statuses)) if (s.kind === "ready") seenStatuses.add(s.evaluation.status);
    }
    expect([...seenStatuses].sort()).toEqual(["CAUTION", "GO", "NO-GO"]);
  });

  it.each(CASES.map((c) => [c.profile.id, c.landingUtc, c] as const))("%s landing %s", async (_id, _utc, { profile, landingUtc }) => {
    const statuses = await panelStatuses(profile, landingUtc);
    const columns = SITE_IDS.map((id) => compareColumn(id, sites, statuses[id] as SiteStatus, profile));
    const rows = metricRows(columns, profile);
    const status = statusCells(columns);
    const html = renderToStaticMarkup(
      routed(createElement(CompareTable, {
        columns,
        rows,
        statuses: status,
        profile,
        landingUtc,
        focusedSiteId: SITE_IDS[0] ?? null,
        onFocusSite: () => undefined,
      })),
    );

    columns.forEach((column, index) => {
      const panel = statuses[column.siteId] as SiteStatus;
      expect(panel.kind).toBe("ready");
      if (panel.kind !== "ready") return;
      const e = panel.evaluation;
      // The same evaluation object the panel draws.
      expect(column.evaluation).toBe(e);
      // The panel's rules and metrics, word for word.
      expect(column.rules).toEqual(describeEvaluation(e, profile));
      const panelMetrics = describeMetrics(e);
      for (const metric of panelMetrics) expect(column.metrics?.[metric.term]).toEqual(metric);
      // The status and score as the panel prints them.
      expect(status[index]?.status).toBe(e.status);
      expect(status[index]?.scoreText).toBe(scoreText(e.score));
      expect(status[index]?.used).toBe(e.status !== "NO-GO");
      // The metric cells print the panel's numbers.
      const text = (term: string) => {
        const m = panelMetrics.find((x) => x.term === term)!;
        return typeof m.value === "number" ? formatValue(m.value, m.unit, m.decimals) : m.value;
      };
      const cell = (id: string) => rows.find((r) => r.id === id)!.cells[index]!;
      expect(cell("sunlight").text).toBe(text("sun_fraction_mean"));
      expect(cell("sunlight").sub).toBe(`${text("lit_fraction")} lit`);
      expect(cell("dark").text).toBe(text("longest_dark_h"));
      expect(cell("link").text).toBe(text("link_fraction"));
      expect(cell("blackout").text).toBe(text("longest_blackout_h"));
      expect(cell("landing_sun").text).toBe(text("landing_sun_el_deg"));
      expect(cell("landing_sun").sub).toBe(e.metrics.landingLit ? "lit" : "dark");
      expect(cell("dark").broken).toBe(e.vetoes.darkness.triggered);
      expect(cell("blackout").broken).toBe(e.vetoes.blackout.triggered);
      expect(cell("slope").broken).toBe(e.vetoes.slope.triggered);
      // And the table draws them.
      for (const id of ["sunlight", "dark", "link", "blackout", "landing_sun", "slope"]) expect(html).toContain(cell(id).text);
      for (const rule of column.rules?.broken ?? []) {
        expect(html).toContain(rule.name);
        if (rule.value !== null) expect(html).toContain(rule.valueLabel);
      }
      expect(html).toContain(e.status);
    });
    // A sphere-tier site says its slope was not assessed.
    expect(html).toContain("Slope not assessed");
    expect(html).toContain("Terrain not modelled");
  });
});

describe("re-rendering", () => {
  it("a scrub does not re-render the table; a new landing date or profile does", async () => {
    const store = createScenarioStore(catalog, `?profile=im2_athena&sites=${SITE_IDS.join(",")}&land=${hourIndexToUtc(grid, 4700)}&t=0&view=compare`);
    const view = () =>
      createElement(ScenarioStoreProvider, { store, children: createElement(Compare, { scenario: store.getState().scenario, mode: "mission" }) });
    await mount(view());
    const settled = compareRenders.count;
    expect(settled).toBeGreaterThan(0);

    for (let step = 1; step <= 24; step += 1) {
      await act(async () => {
        store.getState().stepCurrentTime(1);
        root?.render(routed(view()));
      });
    }
    expect(compareRenders.count).toBe(settled);

    await act(async () => {
      store.getState().slipLanding(7);
      root?.render(routed(view()));
    });
    expect(compareRenders.count).toBeGreaterThan(settled);

    const afterSlip = compareRenders.count;
    await act(async () => {
      store.getState().choosePreset("viper");
      root?.render(routed(view()));
    });
    expect(compareRenders.count).toBeGreaterThan(afterSlip);
  });
});

describe("the summary on the fixture", () => {
  it("names the profile and the landing date, and every site it draws a conclusion about", async () => {
    const profile = profiles.find((p) => p.id === "im2_athena")!;
    const landingUtc = hourIndexToUtc(grid, 4700);
    const statuses = await panelStatuses(profile, landingUtc);
    const columns: ColumnView[] = SITE_IDS.map((id) => compareColumn(id, sites, statuses[id] as SiteStatus, profile));
    const sentence = summarySentence(columns, profile, landingUtc);
    expect(sentence.startsWith(`For ${profile.name} landing 2026-07-15 20:00 UTC`)).toBe(true);
  });
});
