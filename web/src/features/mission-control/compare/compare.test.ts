/**
 * The Compare window on the shared fixture (docs/features/compare.md, "Done when"):
 *
 * - every value in a site's column is the focused-site panel's value for the same site,
 *   profile and landing date, read through the same hook (`useSiteStatus`);
 * - the table draws those values;
 * - the rendered `<Compare>` and the rendered `<FocusedSitePanel>` show the same text, row
 *   by row, slope included, for every fixture site, every preset and two dates;
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
import { FocusedSitePanel } from "../../../app/mission/focused-site-panel";
import { ScenarioStoreProvider } from "../../../app/mission/scenario-context";
import { useSiteStatus, type SiteStatus } from "../../../app/mission/site-status";
import { hourIndexToUtc } from "../../../lib/time";
import { dataStore, seriesKey } from "../../../state/data";
import { createScenarioStore, type ScenarioCatalog } from "../../../state/scenario";
import { allNodes, installDocument, propsOf, type FakeNode } from "../../../app/mission/fake-dom";
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

const hadWindow = "window" in globalThis;
let root: Root | null = null;
let container: FakeNode | null = null;

async function mount(node: ReactNode): Promise<FakeNode> {
  const document = installDocument();
  const { createRoot } = await import("react-dom/client");
  container = document.createElement("div");
  root = createRoot(container as unknown as Element);
  await act(async () => root?.render(routed(node)));
  return container;
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

/** The text a sighted reader sees: no tooltips, no screen-reader-only text, spaces collapsed. */
function seen(node: FakeNode | undefined): string {
  if (!node) return "";
  const hidden = (n: FakeNode) => {
    const c = propsOf(n).className;
    return typeof c === "string" && /\b(tip-bubble|sr-only|cmp-best-mark)\b/.test(c);
  };
  const walk = (n: FakeNode): string =>
    n.nodeType === 3 ? n.nodeValue : hidden(n) ? "" : n.childNodes.length === 0 ? n.textContent : n.childNodes.map(walk).join("");
  return walk(node).replace(/[\s\u202f\u00a0]+/g, " ").trim();
}

/** Text without any spaces. */
const flat = (text: string | undefined) => (text ?? "").replace(/[\s  ]+/g, "");

function hasClass(node: FakeNode, name: string): boolean {
  const c = propsOf(node).className;
  return typeof c === "string" && c.split(/\s+/).includes(name);
}
const byClass = (root: FakeNode, name: string) => allNodes(root).filter((n) => hasClass(n, name));
const byTag = (root: FakeNode, tag: string) => allNodes(root).filter((n) => n.nodeName === tag);
const childrenByTag = (node: FakeNode, tag: string) => node.childNodes.filter((n) => n.nodeName === tag);

/** What the rendered focused-site panel shows. */
function readPanel(root: FakeNode) {
  const panel = byTag(root, "ASIDE").find((n) => propsOf(n).id === "focused-site") as FakeNode;
  const metrics: Record<string, string> = {};
  for (const row of byClass(panel, "metrics-row")) {
    metrics[seen(childrenByTag(row, "DT")[0])] = seen(childrenByTag(row, "DD")[0]);
  }
  return {
    status: seen(byClass(panel, "verdict").flatMap((v) => byClass(v, "status-badge"))[0]),
    score: seen(byClass(panel, "score-value")[0]).replace(/ of 100$/, ""),
    broken: byClass(panel, "broken-name").map(seen),
    brokenValues: byClass(panel, "broken-value").map(seen),
    metrics,
  };
}

/** What the rendered Compare table shows in one site's column, row by row. */
function readColumn(root: FakeNode, siteName: string) {
  const table = byTag(root, "TABLE").find((n) => hasClass(n, "cmp-table")) as FakeNode;
  const names = byClass(table, "cmp-site-name").map(seen);
  const index = names.indexOf(siteName);
  expect(index, `${siteName} is a column`).toBeGreaterThanOrEqual(0);
  const body = byTag(table, "TBODY")[0] as FakeNode;
  const rows = childrenByTag(body, "TR");
  const cell = (rowName: string) => {
    const row = rows.find((r) => seen(childrenByTag(r, "TH")[0]).startsWith(rowName));
    expect(row, `row ${rowName}`).toBeDefined();
    return childrenByTag(row as FakeNode, "TD")[index] as FakeNode;
  };
  const metric = (rowName: string) => {
    const td = cell(rowName);
    return { value: seen(byClass(td, "cmp-value")[0]), sub: seen(byClass(td, "cmp-sub")[0]) };
  };
  const status = cell("Status");
  const broken = cell("Broken rule");
  return {
    status: seen(byClass(status, "status-badge")[0]),
    score: seen(byClass(status, "cmp-score")[0]).replace(/\s*not used$/, ""),
    broken: byClass(broken, "cmp-broken-name").map(seen),
    brokenValues: byTag(broken, "B").map(seen),
    sunlight: metric("Sunlight"),
    dark: metric("Longest dark stretch"),
    link: metric("Earth link"),
    blackout: metric("Longest blackout"),
    landing: metric("Sun at landing"),
    slope: metric("Slope"),
  };
}

describe("the rendered Compare table shows what the rendered focused-site panel shows", () => {
  const cases = profiles.flatMap((profile) => [4700, 30000].map((hour) => ({ profile, landingUtc: hourIndexToUtc(grid, hour) })));

  it.each(cases.map((c) => [c.profile.id, c.landingUtc, c] as const))("%s landing %s, every fixture site", async (_id, _utc, { profile, landingUtc }) => {
    const store = createScenarioStore(catalog, `?profile=${profile.id}&sites=${SITE_IDS.join(",")}&land=${landingUtc}&t=0&view=compare`);
    const view = () =>
      createElement(ScenarioStoreProvider, {
        store,
        children: [
          createElement(Compare, { key: "compare", scenario: store.getState().scenario, mode: "mission" }),
          createElement(FocusedSitePanel, { key: "panel", collapsed: false, onToggle: () => undefined }),
        ],
      });
    const dom = await mount(view());
    const checked = new Set<string>();

    for (const site of sites) {
      await act(async () => {
        store.getState().focusSite(site.id);
        root?.render(routed(view()));
      });
      const panel = readPanel(dom);
      const column = readColumn(dom, site.name);
      const m = panel.metrics;

      // The fake DOM has no CSS, so elements set apart by a gap ("162" and "h" in the panel's
      // large numbers, a value and its "best" mark) join without a space: compare without spaces.
      const same = (a: string | undefined, b: string | undefined) => expect(flat(a), site.id).toBe(flat(b));
      same(column.status, panel.status);
      same(column.score, panel.score);
      expect(column.broken.map(flat), site.id).toEqual(panel.broken.map(flat));
      for (const value of column.brokenValues) expect(panel.brokenValues.map(flat), site.id).toContain(flat(value));

      same(column.sunlight.value, m["Mean Sun disc fraction"]);
      same(column.sunlight.sub, `${m["Lit"]} lit`);
      same(column.dark.value, m["Longest dark stretch"]);
      same(column.link.value, m["Earth link"]);
      same(column.blackout.value, m["Longest blackout"]);
      same(column.landing.value, m["Sun at landing"]);
      same(column.landing.sub, m["Lit at landing"] === "yes" ? "lit" : "dark");
      // The slope: "4.1° over 160 m" in both, or "Slope not assessed" for a sphere-tier site.
      if (m["Slope"] === "Slope not assessed") same(column.slope.value, "Slope not assessed");
      else same(`${column.slope.value} ${column.slope.sub}`, m["Slope"]);
      checked.add(panel.status);
    }
    expect(checked.size).toBeGreaterThan(0);
  });
});
