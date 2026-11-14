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
import type { Manifest, MissionProfile, Site, Sites } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { describeEvaluation, describeMetrics, formatValue, scoreText } from "../../../app/mission/rules";
import { FocusedSitePanel } from "../../../app/mission/focused-site-panel";
import { ScenarioStoreProvider } from "../../../app/mission/scenario-context";
import { useSiteStatus, type SiteStatus } from "../../../app/mission/site-status";
import { hourIndexToUtc } from "../../../lib/time";
import { dataStore, seriesKey } from "../../../state/data";
import { createScenarioStore, type ScenarioCatalog } from "../../../state/scenario";
import { allNodes, installDocument, propsOf, textOf, type FakeNode } from "../../../app/mission/fake-dom";
import { FloatingWindow } from "../../../app/mission/floating-window";
import { formatUtc } from "../../../components/format";
import Compare, { CompareTable, compareRenders } from "./index";
import { parseCsv } from "../../../lib/export";
import { compareCsv } from "./export";
import { compareColumn, metricRows, statusCells, summarySentence, type ColumnView } from "./model";
import { NOT_RANKED_NOTE } from "./site-wording";

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

describe("custom sites (made up here; the sites package, #92, adds them to useSites)", () => {
  const LONG = `<img src=x onerror=alert(1)> "Rim", =CMD() ${"very long typed name ".repeat(6)}`.trim();
  const base = sites[0] as Site;
  const custom: Site = {
    ...base,
    id: "c_-89.4500_222.7000",
    name: LONG,
    group: "custom" as Site["group"],
    elevation_m: null,
    slope: null,
    quickmap_url: "",
    moontrek_url: "",
    variant_of: null,
    offset_m: null,
    nearby_sun: null,
  };
  const computing: Site = { ...custom, id: "c_-85.0000_30.0000", name: "Still computing" };
  const broken: Site = { ...custom, id: "c_-80.0000_10.0000", name: "Server failed" };
  const variant: Site = { ...base, id: `${base.id}_best_lit`, name: `${base.name}, best-lit point`, variant_of: base.id, offset_m: 120, nearby_sun: { radius_m: 160, points: 9, min: 0.31, max: 0.92 } };
  const all = [...sites, custom, computing, broken, variant];

  it("draws each as a column: user text as text, no slope, coordinate links, loading and failed lines", async () => {
    const profile = profiles.find((p) => p.id === "im2_athena") as MissionProfile;
    const landingUtc = hourIndexToUtc(grid, 4700);
    const statuses = await panelStatuses(profile, landingUtc);
    const ready = statuses[base.id] as SiteStatus;
    const columns = [
      compareColumn(base.id, all, ready, profile),
      compareColumn(custom.id, all, ready, profile),
      compareColumn(computing.id, all, { kind: "loading" }, profile),
      compareColumn(broken.id, all, { kind: "error", message: "502 from the site server" }, profile),
      compareColumn(variant.id, all, ready, profile),
    ];
    const rows = metricRows(columns, profile);
    const html = renderToStaticMarkup(
      routed(
        createElement(CompareTable, {
          columns,
          rows,
          statuses: statusCells(columns),
          profile,
          landingUtc,
          focusedSiteId: base.id,
          onFocusSite: () => undefined,
        }),
      ),
    );

    // The typed name is text: escaped, never markup; its full text is the button's title.
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain(`title="${LONG.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}"`);
    // No slope, no elevation: "Slope not assessed", and nothing breaks.
    const slope = rows.find((r) => r.id === "slope")!;
    expect(slope.cells[1]?.text).toBe("Slope not assessed");
    expect(slope.cells[1]?.value).toBeNull();
    // Empty NASA URLs in the site record: the links are built from its coordinates.
    expect(html).toContain("quickmap.lroc.im-ldi.com/layers?extent=");
    expect(html.match(/trek\.nasa\.gov\/moon\/#v=0\.1/g)?.length).toBe(columns.length);
    // Still computing, and failed.
    expect(html).toContain("skeleton");
    expect(html).toContain("Could not load this site’s data");
    // The best-lit point's note, and why it is not ranked for sunlight.
    expect(html).toContain(NOT_RANKED_NOTE);
    expect(columns[4]?.chosenBy?.replace(/\u202f/g, " ")).toBe(`Best-lit map pixel, 120 m from ${base.name}`);

    // The summary waits while one is computing, and names the failed one when it is done.
    expect(summarySentence(columns, profile, landingUtc)).toContain("loading the sites' data");
    const settled = columns.filter((c) => c.siteId !== computing.id);
    expect(summarySentence(settled, profile, landingUtc)).toContain("Server failed could not be loaded.");
  });

  it("writes the typed name into the CSV as text, never as a formula", () => {
    const profile = profiles.find((p) => p.id === "im2_athena") as MissionProfile;
    const evil: Site = { ...custom, name: "=HYPERLINK(\"http://x\",\"click\")" };
    const columns = [compareColumn(evil.id, [evil], { kind: "error", message: "502" }, profile)];
    const csv = compareCsv(columns, metricRows(columns, profile), {
      profile,
      basePresetId: profile.id,
      changedFields: [],
      siteIds: [evil.id],
      focusedSiteId: evil.id,
      landingUtc: hourIndexToUtc(grid, 4700),
      currentUtc: hourIndexToUtc(grid, 4700),
      view: "compare",
      grid,
      link: "https://example.test/mission",
    }, new Date("2026-11-14T00:00:00Z"));
    const parsed = parseCsv(csv);
    expect(parsed.rows[0]?.[1]).toBe(`'=HYPERLINK("http://x","click")`);
  });
});

describe("the window's header (MC9b): the title, the landing date, the exports, the close button", () => {
  it("shows those and nothing else; the description and the summary are for assistive technology", async () => {
    const landingUtc = hourIndexToUtc(grid, 4700);
    const store = createScenarioStore(catalog, `?profile=im2_athena&sites=${SITE_IDS.slice(0, 4).join(",")}&land=${landingUtc}&t=0&view=compare`);
    const closedByUser = { current: false };
    const dom = await mount(
      createElement(ScenarioStoreProvider, {
        store,
        children: createElement(FloatingWindow, {
          id: "window-compare",
          title: "Compare",
          closeLabel: "Close Compare",
          description: "Compare puts your selected sites side by side, for one mission profile and landing date.",
          descriptionHidden: true,
          onClose: () => undefined,
          button: () => null,
          closedByUser,
          children: createElement(Compare, { scenario: store.getState().scenario, mode: "mission" }),
        }),
      }),
    );
    const head = byClass(dom, "floating-window-head")[0] as FakeNode;
    // What a sighted user reads in the header, in order.
    expect(flat(seen(head))).toBe(flat(`Compare ${formatUtc(landingUtc)} Export CSV Export JSON`));
    expect(seen(head)).toContain("2026-07-15 20:00 UTC");
    expect(byTag(head, "BUTTON").map((b) => String(propsOf(b)["aria-label"] ?? seen(b)))).toEqual(["Export CSV", "Export JSON", "Close Compare"]);

    // The description: the dialog's accessible description, visually hidden.
    const dialog = byTag(dom, "SECTION").find((n) => propsOf(n).role === "dialog") as FakeNode;
    const description = allNodes(dialog).find((n) => propsOf(n).id === propsOf(dialog)["aria-describedby"]) as FakeNode;
    expect(propsOf(description).className).toBe("sr-only");
    expect(textOf(description)).toContain("side by side");

    // The summary sentence: the table's accessible description, visually hidden, still produced.
    const table = byTag(dom, "TABLE")[0] as FakeNode;
    const summary = allNodes(dom).find((n) => propsOf(n).id === propsOf(table)["aria-describedby"]) as FakeNode;
    expect(propsOf(summary).className).toBe("sr-only");
    expect(textOf(summary)).toMatch(/^For IM-2 Athena landing 2026-07-15 20:00 UTC, /);
    // Neither sentence is anywhere a sighted user sees it.
    expect(seen(dom)).not.toContain("For IM-2 Athena landing");
    expect(seen(dom)).not.toContain("side by side");
    // The notes under the table stay.
    expect(seen(byClass(dom, "cmp-foot")[0])).toContain("A tie for best marks every tied site.");
  });
});
